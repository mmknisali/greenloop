<?php
require __DIR__ . '/config.php';

const MESSAGE_FIELDS = 'm.*, cv.company_id, cv.user_id AS participant_user_id';
const MESSAGE_FROM = ' FROM messages m
    JOIN conversations cv ON cv.id = m.conversation_id
    JOIN companies c ON c.id = cv.company_id';
const MESSAGE_RECIPIENT = "((m.from_side = 'user' AND c.user_id = ? AND cv.hidden_by_company = 0)
    OR (m.from_side = 'company' AND cv.user_id = ? AND cv.hidden_by_sender = 0))";

$action = $_GET['action'] ?? '';
$method = match ($action) {
    'send', 'reply', 'read', 'delete_thread' => 'POST',
    'threads', 'thread', 'conversation', 'sent', 'poll' => 'GET',
    default => err('Geçersiz işlem.', 404),
};
if ($_SERVER['REQUEST_METHOD'] !== $method) {
    header('Allow: ' . $method);
    err('Geçersiz istek yöntemi.', 405);
}
match ($action) {
    'send'          => sendMessage(),
    'threads'       => listThreads(true),
    'thread'        => getThread(),
    'conversation'  => getConversation(),
    'sent'          => listThreads(false),
    'read'          => markRead(),
    'reply'         => sendReply(),
    'poll'          => pollNew(),
    'delete_thread' => deleteThread(),
};

function messageNumber(mixed $value, string $field, int $min = 1): int {
    if ((!is_string($value) && !is_int($value)) || !ctype_digit((string)$value)) {
        err($field . ' geçerli bir tam sayı olmalıdır.');
    }
    $number = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => $min, 'max_range' => 4294967295]]);
    if ($number === false) err($field . ' geçerli bir tam sayı olmalıdır.');
    return $number;
}

function fmtMsg(array $m): array {
    $company = $m['from_side'] === 'company';
    $m['from_company_id'] = $m['fromCompanyId'] = $company ? $m['company_id'] : null;
    $m['from_user_id']    = $m['fromUserId']    = $company ? null : $m['participant_user_id'];
    $m['to_company_id']   = $m['toCompanyId']   = $m['company_id'];
    $m['to_user_id']      = $m['toUserId']      = $company ? $m['participant_user_id'] : null;
    $m['fromName']       = $m['from_name'];
    $m['fromEmail']      = $m['from_email'];
    $m['text']           = $m['body'];
    $m['read']           = (bool)$m['is_read'];
    $m['createdAt']      = $m['created_at'];
    $m['conversationId'] = (int)$m['conversation_id'];
    $m['cursorId']       = (int)$m['cursor_id'];
    unset($m['company_id'], $m['participant_user_id'], $m['company_name'], $m['company_icon']);
    return $m;
}

function messageTransaction(callable $work): mixed {
    $db = db();
    $db->beginTransaction();
    try {
        $result = $work($db);
        $db->commit();
        return $result;
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}

function insertMessage(PDO $db, int $conversationId, string $companyId, string $side, string $name, ?string $email,
                       string $text, ?string $toName = null, ?string $toEmail = null): array {
    $db->prepare('UPDATE conversations SET hidden_by_company = 0, hidden_by_sender = 0 WHERE id = ?')
       ->execute([$conversationId]);

    // Serialize cursor allocation through commit: auto-increment alone permits a later ID to commit first.
    if ($db->query('SELECT id FROM message_write_lock WHERE id = 1 FOR UPDATE')->fetchColumn() === false) {
        throw new RuntimeException('Message cursor lock is missing.');
    }
    $id = newId('msg');
    $db->prepare('INSERT INTO messages (id, conversation_id, to_company_id, from_side, from_name, from_email, to_name, to_email, body)
                  VALUES (?,?,?,?,?,?,?,?,?)')
       ->execute([$id, $conversationId, $companyId, $side, $name, $email, $toName, $toEmail, $text]);

    // The upsert may have reused a conversation committed after this transaction's snapshot.
    $get = $db->prepare('SELECT ' . MESSAGE_FIELDS . ' FROM messages m
        JOIN conversations cv ON cv.id = m.conversation_id WHERE m.id = ? FOR UPDATE');
    $get->execute([$id]);
    return fmtMsg($get->fetch());
}

function sendMessage(): void {
    $b = body();
    $user = $_SESSION['user'] ?? null;
    if (!$user) {
        rateLimit('guest-message:' . requestIp(), 20, 600);
        if (($b['website'] ?? '') !== '') err('Mesaj gönderilemedi.');
    }

    $companyId = str($b, 'toCompanyId');
    $text = str($b, 'text');
    if ($companyId === '') err('Şirket ID gerekli.');
    if ($text === '') err('Mesaj boş olamaz.');
    maxLen($companyId, 64, 'Şirket ID');
    maxLen($text, 5000, 'Mesaj');

    $userId = $user['id'] ?? null;
    $name = $user ? $user['ad'] . ' ' . $user['soyad'] : str($b, 'fromName');
    $email = $user ? $user['email'] : str($b, 'fromEmail');
    if (!$user) {
        if ($name === '') err('Adınızı girin.');
        maxLen($name, 190, 'Ad');
        maxLen($email, 190, 'E-posta');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) err('Geçerli e-posta girin.');
    }
    $guestEmail = $user ? null : strtolower($email);

    $message = messageTransaction(function (PDO $db) use ($companyId, $userId, $guestEmail, $name, $email, $text) {
        $co = $db->prepare('SELECT id FROM companies WHERE id = ?');
        $co->execute([$companyId]);
        $companyId = $co->fetchColumn();
        if ($companyId === false) return null;

        $upsert = $db->prepare('INSERT INTO conversations (company_id, user_id, guest_email, guest_name) VALUES (?,?,?,?)
                                ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), guest_name = VALUES(guest_name)');
        $upsert->execute([$companyId, $userId, $guestEmail, $userId ? null : $name]);
        return insertMessage($db, (int)$db->lastInsertId(), $companyId, 'user', $name, $email, $text);
    });
    if ($message === null) err('Şirket bulunamadı.', 404);
    resp(['ok' => true, 'data' => $message], 201);
}

function listThreads(bool $companySide): void {
    $user = requireAuth();
    $scope = $companySide ? 'c.user_id = ? AND cv.hidden_by_company = 0' : 'cv.user_id = ? AND cv.hidden_by_sender = 0';
    $stmt = db()->prepare('SELECT ' . MESSAGE_FIELDS . ', c.name AS company_name, c.icon AS company_icon'
        . MESSAGE_FROM . " WHERE $scope ORDER BY m.cursor_id");
    $stmt->execute([$user['id']]);

    $threads = [];
    while ($row = $stmt->fetch()) {
        $m = fmtMsg($row);
        $id = $m['conversationId'];
        if (!isset($threads[$id])) {
            $threads[$id] = ['conversationId' => $id, 'companyId' => $m['toCompanyId'], 'msgs' => []];
            if ($companySide) {
                $threads[$id]['senderName'] = $m['to_name'] ?? '';
                $threads[$id]['senderEmail'] = $m['to_email'];
                $threads[$id]['senderUserId'] = $row['participant_user_id'];
            } else {
                $threads[$id]['companyName'] = $row['company_name'];
                $threads[$id]['companyIcon'] = $row['company_icon'] ?? 'factory';
            }
        }
        if ($companySide && $m['from_side'] === 'user') {
            $threads[$id]['senderName'] = $m['fromName'];
            $threads[$id]['senderEmail'] = $m['fromEmail'];
        }
        $threads[$id]['msgs'][] = $m;
        $threads[$id]['lastMsg'] = $m;
    }
    $threads = array_values($threads);
    usort($threads, fn($a, $b) => $b['lastMsg']['cursorId'] <=> $a['lastMsg']['cursorId']);
    resp(['ok' => true, 'data' => $threads]);
}

function getThread(): void {
    $user = requireAuth();
    $id = messageNumber($_GET['id'] ?? null, 'id');
    $stmt = db()->prepare('SELECT ' . MESSAGE_FIELDS . MESSAGE_FROM . '
        WHERE cv.id = ? AND ((c.user_id = ? AND cv.hidden_by_company = 0) OR (cv.user_id = ? AND cv.hidden_by_sender = 0))
        ORDER BY m.cursor_id');
    $stmt->execute([$id, $user['id'], $user['id']]);
    $rows = $stmt->fetchAll();
    if (!$rows) err('Konuşma bulunamadı.', 404);
    resp(['ok' => true, 'data' => array_map('fmtMsg', $rows)]);
}

function getConversation(): void {
    $user = requireAuth();
    $companyId = str($_GET, 'company_id');
    if ($companyId === '') err('company_id gerekli.');
    maxLen($companyId, 64, 'Şirket ID');
    $stmt = db()->prepare('SELECT ' . MESSAGE_FIELDS . MESSAGE_FROM . '
        WHERE cv.company_id = ? AND cv.user_id = ? AND cv.hidden_by_sender = 0 ORDER BY m.cursor_id');
    $stmt->execute([$companyId, $user['id']]);
    resp(['ok' => true, 'data' => array_map('fmtMsg', $stmt->fetchAll())]);
}

function markRead(): void {
    $userId = requireAuth()['id'];
    $ids = body()['ids'] ?? null;
    if (!is_array($ids) || !array_is_list($ids) || count($ids) > 200) err('ids en fazla 200 mesaj ID içeren bir dizi olmalıdır.');
    foreach ($ids as $id) {
        if (!is_string($id) || trim($id) === '') err('Geçersiz mesaj ID.');
        maxLen($id, 64, 'Mesaj ID');
    }
    $ids = array_values(array_unique($ids));
    if (!$ids) resp(['ok' => true, 'data' => ['updated' => 0]]);
    $in = implode(',', array_fill(0, count($ids), '?'));

    $updated = messageTransaction(function (PDO $db) use ($ids, $in, $userId) {
        $check = $db->prepare('SELECT m.id' . MESSAGE_FROM . " WHERE m.id IN ($in) AND " . MESSAGE_RECIPIENT . ' FOR UPDATE');
        $check->execute([...$ids, $userId, $userId]);
        if (count($check->fetchAll()) !== count($ids)) return null;

        $stmt = $db->prepare("UPDATE messages SET is_read = 1 WHERE id IN ($in) AND is_read = 0");
        $stmt->execute($ids);
        return $stmt->rowCount();
    });
    if ($updated === null) err('Yetkisiz.', 403);
    resp(['ok' => true, 'data' => ['updated' => $updated]]);
}

function lockConversation(PDO $db, int $id): array|false {
    $stmt = $db->prepare('SELECT cv.*, c.user_id AS owner_id, c.name AS company_name
        FROM conversations cv JOIN companies c ON c.id = cv.company_id WHERE cv.id = ? FOR UPDATE');
    $stmt->execute([$id]);
    return $stmt->fetch();
}

function sendReply(): void {
    $user = requireAuth();
    rateLimit('reply:' . $user['id'], 30, 600);
    $b = body();
    $id = messageNumber($b['conversationId'] ?? null, 'conversationId');
    $text = str($b, 'text');
    if ($text === '') err('Mesaj boş olamaz.');
    maxLen($text, 5000, 'Mesaj');
    $type = conversationSide($b);

    $message = messageTransaction(function (PDO $db) use ($id, $user, $text, $type) {
        $cv = lockConversation($db, $id);
        if (!$cv) return null;
        $side = participantSide($cv, $user['id'], $type);
        if ($side === null) return null;
        if ($side === 'user') {
            return insertMessage($db, $id, $cv['company_id'], 'user', $user['ad'] . ' ' . $user['soyad'], $user['email'], $text);
        }

        if ($cv['user_id'] !== null) {
            $stmt = $db->prepare("SELECT CONCAT(ad, ' ', soyad) AS name, email FROM users WHERE id = ?");
            $stmt->execute([$cv['user_id']]);
            $recipient = $stmt->fetch();
            $name = $recipient['name'];
            $email = $recipient['email'];
        } else {
            $name = $cv['guest_name'];
            $email = $cv['guest_email'] === '' ? null : $cv['guest_email'];
        }
        return insertMessage($db, $id, $cv['company_id'], 'company', $cv['company_name'], null, $text, $name, $email);
    });
    if ($message === null) err('Yetkisiz.', 403);
    resp(['ok' => true, 'data' => $message], 201);
}

function pollNew(): void {
    $user = requireAuth();
    $sinceId = messageNumber($_GET['since_id'] ?? 0, 'since_id', 0);
    $companyId = str($_GET, 'company_id');
    maxLen($companyId, 64, 'Şirket ID');
    $filter = $companyId === '' ? '' : ' AND cv.company_id = ?';
    $stmt = db()->prepare('SELECT ' . MESSAGE_FIELDS . MESSAGE_FROM . ' WHERE m.cursor_id > ? AND '
        . MESSAGE_RECIPIENT . $filter . ' ORDER BY m.cursor_id LIMIT 200');
    $params = [$sinceId, $user['id'], $user['id']];
    if ($filter !== '') $params[] = $companyId;
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    $lastId = $rows ? (int)$rows[count($rows) - 1]['cursor_id'] : $sinceId;
    resp(['ok' => true, 'data' => ['messages' => array_map('fmtMsg', $rows), 'lastId' => $lastId]]);
}

function conversationSide(array $b): string {
    $type = $b['type'] ?? '';
    if (!in_array($type, ['', 'in', 'out', 'sent'], true)) err('Geçersiz konuşma türü.');
    return $type;
}

function participantSide(array $cv, string $userId, string $type): ?string {
    if ($cv['owner_id'] === $userId && ($type === '' || $type === 'in')) return 'company';
    if ($cv['user_id'] === $userId && $type !== 'in') return 'user';
    return null;
}

function deleteThread(): void {
    $user = requireAuth();
    rateLimit('thread-hide:' . $user['id'], 30, 600);
    $b = body();
    $id = messageNumber($b['conversationId'] ?? null, 'conversationId');
    $type = conversationSide($b);

    $hidden = messageTransaction(function (PDO $db) use ($id, $type, $user) {
        $cv = lockConversation($db, $id);
        if (!$cv) return false;
        $side = participantSide($cv, $user['id'], $type);
        if ($side === null) return false;

        $field = $side === 'company' ? 'hidden_by_company' : 'hidden_by_sender';
        $db->prepare("UPDATE conversations SET $field = 1 WHERE id = ?")->execute([$id]);
        return true;
    });
    if (!$hidden) err('Yetkisiz.', 403);
    resp(['ok' => true, 'data' => null]);
}
