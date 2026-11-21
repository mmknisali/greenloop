<?php
header('Content-Type: application/json; charset=utf-8');

// Database settings. The defaults match the devenv setup; a deployment overrides
// them with environment variables instead of editing this file.
define('DB_HOST', getenv('GREENLOOP_DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('GREENLOOP_DB_NAME') ?: 'greenloop');
define('DB_USER', getenv('GREENLOOP_DB_USER') ?: 'root');
define('DB_PASS', getenv('GREENLOOP_DB_PASS') ?: '');
define('DB_CHARSET', 'utf8mb4');
define('CHAT_KEY', trim(getenv('GREENLOOP_CHAT_KEY') ?: ''));
define('CHAT_BASE_URL', rtrim(trim(getenv('GREENLOOP_CHAT_BASE_URL') ?: 'https://opencode.ai/inference/openai/v1'), '/'));
// Zen documents these as limited-time free models in OpenCode, not free third-party API access.
define('CHAT_MODELS', getenv('GREENLOOP_CHAT_MODELS') ?: 'big-pickle,deepseek-v4.1-flash-free,hy4-flash-free');

// Uncaught errors (a dropped database, a bug) answer with the same JSON envelope
// as every other failure and keep the details in the server log, not the response.
ini_set('display_errors', '0');
set_exception_handler(function (Throwable $e): void {
    error_log('[greenloop] ' . $e::class . ': ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) http_response_code(500);
    echo json_encode(['ok' => false, 'msg' => 'Sunucu hatası. Lütfen tekrar deneyin.'], JSON_UNESCAPED_UNICODE);
    exit;
});

function db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $pdo = new PDO(
        'mysql:host='.DB_HOST.';dbname='.DB_NAME.';charset='.DB_CHARSET,
        DB_USER, DB_PASS,
        [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]
    );
    return $pdo;
}

ini_set('session.use_strict_mode', '1');
$previewScope = previewScope();
session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure'   => $previewScope === 'shared' || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
]);
session_start();
if (!empty($_SESSION['user']['previewAdmin']) &&
    ($_SESSION['user']['previewScope'] ?? null) !== $previewScope) {
    unset($_SESSION['user']);
}

function previewScope(): ?string {
    if (getenv('GREENLOOP_PREVIEW_ADMIN') !== '1' || PHP_SAPI !== 'cli-server' ||
        !in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) return null;

    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $sharedHost = strtolower(trim(getenv('GREENLOOP_PREVIEW_HOST') ?: ''));
    // Trust the HTTPS indication only for the configured hostname from the loopback tunnel.
    if ($sharedHost !== '' && $host === $sharedHost && ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') {
        return 'shared';
    }
    if (preg_match('/\A(?:127\.0\.0\.1|localhost|\[::1\])(?::\d{1,5})?\z/', $host) &&
        !isset($_SERVER['HTTP_FORWARDED']) && !isset($_SERVER['HTTP_X_FORWARDED_FOR']) &&
        !isset($_SERVER['HTTP_X_FORWARDED_HOST']) && !isset($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        return 'local';
    }
    return null;
}

function resp(mixed $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function err(string $msg, int $code = 400): never {
    resp(['ok' => false, 'msg' => $msg], $code);
}

function rateLimit(string $key, int $max, int $windowSeconds): void {
    $pdo = db();
    $now = time();
    $cutoff = $now - $windowSeconds;
    $pdo->beginTransaction();
    try {
        $pdo->prepare('INSERT INTO rate_limits (`key`, window_start, hits) VALUES (?, ?, 1)
            ON DUPLICATE KEY UPDATE hits = IF(window_start <= ?, 1, LEAST(hits + 1, ?)),
                                    window_start = IF(window_start <= ?, VALUES(window_start), window_start)')
            ->execute([$key, $now, $cutoff, $max + 1, $cutoff]);
        $stmt = $pdo->prepare('SELECT window_start, hits FROM rate_limits WHERE `key` = ?');
        $stmt->execute([$key]);
        $row = $stmt->fetch();
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    if (random_int(1, 100) === 1) {
        $pdo->prepare('DELETE FROM rate_limits WHERE window_start < ?')->execute([$now - 86400]);
    }
    if ($row['hits'] > $max) {
        header('Retry-After: ' . max(1, $row['window_start'] + $windowSeconds - $now));
        err('Çok fazla istek gönderdiniz. Lütfen daha sonra tekrar deneyin.', 429);
    }
}

function requestIp(): string {
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function body(): array {
    static $b = null;
    if ($b !== null) return $b;
    // Only a JSON object counts as a body; a bare string or number is treated as empty.
    $decoded = json_decode(file_get_contents('php://input'), true);
    $b = is_array($decoded) ? $decoded : [];
    return $b;
}

/** A trimmed string field from the request body. Missing, array or object values read as ''. */
function str(array $src, string $key): string {
    $v = $src[$key] ?? '';
    return is_scalar($v) ? trim((string)$v) : '';
}

/** Rejects a value longer than the column it is stored in. */
function maxLen(string $value, int $max, string $label): void {
    // Counts characters, not bytes (Turkish letters are two bytes), without needing the mbstring extension.
    $chars = preg_match_all('/./su', $value);
    if ($chars === false) $chars = strlen($value);
    if ($chars > $max) err($label . ' en fazla ' . $max . ' karakter olabilir.');
}

function requireAuth(): array {
    if (empty($_SESSION['user'])) err('Oturum açmanız gerekiyor.', 401);
    return $_SESSION['user'];
}

function newId(string $prefix = 'id'): string {
    return $prefix . '_' . uniqid('', true);
}
