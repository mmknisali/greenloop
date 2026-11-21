<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/matches.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    err('Geçersiz istek yöntemi.', 405);
}
session_write_close();
rateLimit('chat:' . requestIp(), 20, 600);

$raw = file_get_contents('php://input', false, null, 0, 131073);
if (strlen($raw) > 131072) err('İstek çok uzun.', 413);
$history = json_decode($raw, true)['messages'] ?? null;
if (!is_array($history) || !array_is_list($history)) err('Geçerli bir mesaj listesi gönderin.');
$messages = [];
for ($i = count($history) - 1; $i >= 0 && count($messages) < 6; --$i) {
    $entry = $history[$i];
    $role = $entry['role'] ?? null;
    $content = $entry['content'] ?? null;
    if (!in_array($role, ['user', 'assistant'], true) || !is_string($content)) continue;
    $content = trim(mb_substr(trim($content), 0, 1000, 'UTF-8'));
    if ($content !== '') $messages[] = ['role' => $role, 'content' => $content];
}
$question = '';
foreach ($messages as $message) {
    if ($message['role'] === 'user') {
        $question = $message['content'];
        break;
    }
}
if ($question === '') err('Kullanıcı mesajı gerekli.');
$messages = array_reverse($messages);

ini_set('zlib.output_compression', '0');
while (ob_get_level() > 0 && ob_end_clean()) {}
header('Content-Type: text/event-stream; charset=utf-8');
header('Cache-Control: no-cache, no-transform');
header('X-Accel-Buffering: no');

try {
    if (CHAT_KEY !== '') {
        $companies = chatCompanies($question);
        chatEvent($companies, 'companies');
        $lines = array_map(static fn(array $company): string => json_encode($company,
            JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_THROW_ON_ERROR), $companies);
        $context = $lines ? implode("\n", $lines) : 'Eşleşen şirket bulunamadı.';
        $prompt = file_get_contents(__DIR__ . '/prompts/master.md');
        if ($prompt === false) throw new RuntimeException('Chat prompt unavailable.');
        array_unshift($messages, ['role' => 'system', 'content' => str_replace('{{context}}', $context, $prompt)]);

        $models = array_unique(array_filter(array_map('trim', explode(',', CHAT_MODELS)), 'strlen'));
        foreach (array_slice($models, 0, 5) as $model) {
            if (connection_aborted()) exit;
            [$complete, $started] = streamChatModel($model, $messages);
            if ($complete) chatDone();
            if ($started) chatEvent(null, 'reset');
        }
    }
} catch (Throwable $e) {
    // Do not log prompt text, upstream response bodies, headers, or credentials.
    error_log('[greenloop] Chat error: ' . $e::class);
    chatEvent(null, 'reset');
}
chatEvent(['text' => 'Asistan şu an yoğun, lütfen biraz sonra tekrar deneyin.']);
chatDone();

function chatCompanies(string $question): array {
    $companies = loadPublicCompanies();
    $tokens = static fn(string $text): array => preg_split('/[^\p{L}\p{N}]+/u', normalizeTag($text), -1, PREG_SPLIT_NO_EMPTY);
    $words = array_fill_keys($tokens($question), true);
    $tags = [];
    foreach ($companies as $company) {
        foreach ([...$company['inputs'], ...$company['outputs']] as $rawTag) {
            foreach ($tokens($rawTag) as $token) {
                if (isset($words[$token]) && mb_strlen($token, 'UTF-8') >= 2) {
                    $tags[normalizeTag($rawTag)] = true;
                    break;
                }
            }
        }
    }
    $matches = searchMatches($companies, array_keys($tags));
    $fields = array_flip(['id', 'name', 'il', 'sector', 'inputs', 'outputs']);
    return array_map(static fn(array $m): array => array_intersect_key($m['company'], $fields), array_slice($matches, 0, 5));
}

function chatEvent(mixed $data, ?string $event = null): void {
    if ($event !== null) echo "event: $event\n";
    echo 'data: ', json_encode(['ok' => true, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE), "\n\n";
    flush();
}

function chatDone(): never {
    echo "data: [DONE]\n\n";
    flush();
    exit;
}

function streamChatModel(string $model, array $messages): array {
    $ch = curl_init(CHAT_BASE_URL . '/chat/completions');
    $buffer = '';
    $sent = $finished = false;
    $bytes = 0;
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: text/event-stream', 'Authorization: Bearer ' . CHAT_KEY],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => $model, 'messages' => $messages, 'stream' => true, 'temperature' => 0.3, 'max_tokens' => 400,
        ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
        CURLOPT_WRITEFUNCTION => static function (CurlHandle $ch, string $chunk) use (&$buffer, &$sent, &$finished, &$bytes): int {
            $length = strlen($chunk);
            $bytes += $length;
            if ($bytes > 1048576 || connection_aborted()) return 0;
            if (curl_getinfo($ch, CURLINFO_RESPONSE_CODE) !== 200 || $finished) return $length;
            $buffer .= $chunk;
            while (preg_match('/\r?\n\r?\n/', $buffer, $delimiter, PREG_OFFSET_CAPTURE)) {
                [$separator, $offset] = $delimiter[0];
                $frame = substr($buffer, 0, $offset);
                $buffer = substr($buffer, $offset + strlen($separator));
                $data = [];
                foreach (explode("\n", $frame) as $line) {
                    if (str_starts_with($line, 'data:')) $data[] = trim(substr($line, 5));
                }
                $payload = implode("\n", $data);
                if ($payload === '[DONE]') {
                    $finished = true;
                    break;
                }
                $choice = json_decode($payload, true)['choices'][0] ?? [];
                $text = $choice['delta']['content'] ?? null;
                if (is_string($text) && $text !== '') {
                    chatEvent(['text' => $text]);
                    $sent = true;
                }
            }
            return $length;
        },
    ]);
    $ok = curl_exec($ch);
    curl_close($ch);
    return [$ok && $sent && $finished, $sent];
}
