<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

match ($action) {
    'send'         => sendMessage(),
    'threads'      => getThreads(),
    'thread'       => getThread(),
    'conversation' => getConversation(),
    'sent'         => getSentThreads(),
    'read'         => markRead(),
    'reply'        => sendReply(),
    'poll'         => pollNew(),
    'delete_thread'=> deleteThread(),
    default        => err('Geçersiz işlem.', 404),
};

function threadKey(array $m): string {
    if (!empty($m['from_company_id'])) {
        return $m['to_company_id'] . '|' . ($m['to_user_id'] ?? $m['to_email'] ?? 'guest');
    }
    return $m['to_company_id'] . '|' . ($m['from_user_id'] ?? $m['from_email'] ?? 'guest');
}

function fmtMsg(array $m): array {
    $m['fromName']      = $m['from_name'];
    $m['fromEmail']     = $m['from_email'];
    $m['fromUserId']    = $m['from_user_id'];
    $m['fromCompanyId'] = $m['from_company_id'];
    $m['toCompanyId']   = $m['to_company_id'];
    $m['toUserId']      = $m['to_user_id'];
    $m['text']          = $m['body'];
    $m['read']          = (bool)$m['is_read'];
    $m['createdAt']     = $m['created_at'];
    return $m;
}

function sendMessage(): void {
    $b           = body();
    $toCompanyId = $b['toCompanyId'] ?? '';
    $text        = trim($b['text']   ?? '');
    if (!$toCompanyId) err('Şirket ID gerekli.');
    if (!$text)        err('Mesaj boş olamaz.');

    $chk = db()->prepare('SELECT id FROM companies WHERE id = ?');
    $chk->execute([$toCompanyId]);
    if (!$chk->fetch()) err('Şirket bulunamadı.', 404);

    $fromUserId = null;
    $fromName   = trim($b['fromName']  ?? '');
    $fromEmail  = trim($b['fromEmail'] ?? '');

    if (!empty($_SESSION['user'])) {
        $u = $_SESSION['user'];
        $fromUserId = $u['id'];
        $fromName   = $u['ad'] . ' ' . $u['soyad'];
        $fromEmail  = $u['email'];
    } else {
        if (!$fromName) err('Adınızı girin.');
        if (!$fromEmail || !filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) err('Geçerli e-posta girin.');
    }

    $id = newId('msg');
    db()->prepare('INSERT INTO messages (id,to_company_id,from_user_id,from_name,from_email,body) VALUES (?,?,?,?,?,?)')
       ->execute([$id, $toCompanyId, $fromUserId, $fromName, $fromEmail, $text]);

    $get = db()->prepare('SELECT * FROM messages WHERE id = ?');
    $get->execute([$id]);
    resp(['ok' => true, 'data' => fmtMsg($get->fetch())], 201);
}

function getThreads(): void {
    $user = requireAuth();
    $stmt = db()->prepare('SELECT id FROM companies WHERE user_id = ?');
    $stmt->execute([$user['id']]);
    $companyIds = array_column($stmt->fetchAll(), 'id');
    if (!$companyIds) resp(['ok' => true, 'data' => []]);

    $in   = implode(',', array_fill(0, count($companyIds), '?'));
    $msgs = db()->prepare("SELECT * FROM messages WHERE to_company_id IN ($in) ORDER BY created_at ASC");
    $msgs->execute($companyIds);
    $all  = $msgs->fetchAll();

    $threads = [];
    foreach ($all as $m) {
        $key = threadKey($m);
        if (!isset($threads[$key])) {
            $threads[$key] = ['key' => $key, 'companyId' => $m['to_company_id'], 'msgs' => [], 'lastMsg' => null, 'senderName' => '', 'senderUserId' => null, 'senderEmail' => null];
        }
        $threads[$key]['msgs'][]  = fmtMsg($m);
        $threads[$key]['lastMsg'] = fmtMsg($m);
        if (empty($m['from_company_id'])) {
            $threads[$key]['senderName']   = $m['from_name'];
            $threads[$key]['senderUserId'] = $m['from_user_id'];
            $threads[$key]['senderEmail']  = $m['from_email'];
        }
    }

    $arr = array_values($threads);
    usort($arr, fn($a, $b) => strcmp($b['lastMsg']['createdAt'], $a['lastMsg']['createdAt']));
    resp(['ok' => true, 'data' => $arr]);
}

function getThread(): void {
    $user = requireAuth();
    $key = $_GET['key'] ?? '';
    if (!$key) err('key gerekli.');

    $sep = strpos($key, '|');
    if ($sep === false) err('Geçersiz key.');
    $companyId = substr($key, 0, $sep);
    $senderId  = substr($key, $sep + 1);

    $co = db()->prepare('SELECT user_id FROM companies WHERE id = ?');
    $co->execute([$companyId]);
    $coRow = $co->fetch();
    if (!$coRow)                           err('Konuşma bulunamadı.', 404);
    if ($coRow['user_id'] !== $user['id']) err('Yetkisiz.', 403);

    if ($senderId === 'guest') {
        $condA = 'from_user_id IS NULL AND (from_email IS NULL OR from_email = \'\')';
        $condB = 'to_user_id IS NULL AND (to_email IS NULL OR to_email = \'\')';
        $paramsA = [];
        $paramsB = [$companyId];
    } else {
        $condA = 'from_user_id = ? OR (from_user_id IS NULL AND from_email = ?)';
        $condB = 'to_user_id = ? OR (to_user_id IS NULL AND to_email = ?)';
        $paramsA = [$senderId, $senderId];
        $paramsB = [$companyId, $senderId, $senderId];
    }

    $stmt = db()->prepare("SELECT * FROM messages WHERE to_company_id = ? AND (
        (from_company_id IS NULL AND ({$condA}))
        OR (from_company_id = ? AND ({$condB}))
        ) ORDER BY created_at ASC");
    $stmt->execute(array_merge([$companyId], $paramsA, $paramsB));

    resp(['ok' => true, 'data' => array_map('fmtMsg', $stmt->fetchAll())]);
}

function getConversation(): void {
    $user      = requireAuth();
    $companyId = $_GET['company_id'] ?? '';
    if (!$companyId) err('company_id gerekli.');
    $stmt = db()->prepare('SELECT * FROM messages
        WHERE to_company_id = ?
          AND ((from_company_id IS NULL AND from_user_id = ?) OR (from_company_id = ? AND to_user_id = ?))
        ORDER BY created_at ASC');
    $stmt->execute([$companyId, $user['id'], $companyId, $user['id']]);
    resp(['ok' => true, 'data' => array_map('fmtMsg', $stmt->fetchAll())]);
}

function markRead(): void {
    $user = requireAuth();
    $id = $_GET['id'] ?? '';
    if (!$id) err('id gerekli.');

    $own = db()->prepare('SELECT m.id FROM messages m
        INNER JOIN companies c ON c.id = m.to_company_id
        WHERE m.id = ? AND (c.user_id = ? OR m.to_user_id = ?)');
    $own->execute([$id, $user['id'], $user['id']]);
    if (!$own->fetch()) err('Yetkisiz.', 403);

    db()->prepare('UPDATE messages SET is_read = 1 WHERE id = ?')->execute([$id]);
    resp(['ok' => true]);
}

function getSentThreads(): void {
    $user = requireAuth();
    $stmt = db()->prepare('SELECT * FROM messages WHERE from_user_id = ? ORDER BY created_at ASC');
    $stmt->execute([$user['id']]);
    $all = $stmt->fetchAll();

    $threads = [];
    foreach ($all as $m) {
        $cid = $m['to_company_id'];
        if (!isset($threads[$cid])) {
            $co = db()->prepare('SELECT name, emoji FROM companies WHERE id = ?');
            $co->execute([$cid]);
            $coRow = $co->fetch();
            $threads[$cid] = [
                'companyId'    => $cid,
                'companyName'  => $coRow['name']  ?? '—',
                'companyEmoji' => $coRow['emoji'] ?? '🏭',
                'msgs'         => [],
                'lastMsg'      => null,
            ];
        }
        $threads[$cid]['msgs'][]  = fmtMsg($m);
        $threads[$cid]['lastMsg'] = fmtMsg($m);
    }

    foreach (array_keys($threads) as $cid) {
        $stmt2 = db()->prepare('SELECT * FROM messages WHERE from_company_id = ? AND to_user_id = ? ORDER BY created_at ASC');
        $stmt2->execute([$cid, $user['id']]);
        foreach ($stmt2->fetchAll() as $m) {
            $threads[$cid]['msgs'][]  = fmtMsg($m);
            $threads[$cid]['lastMsg'] = fmtMsg($m);
        }
        usort($threads[$cid]['msgs'], fn($a, $b) => strcmp($a['createdAt'], $b['createdAt']));
    }

    $arr = array_values($threads);
    usort($arr, fn($a, $b) => strcmp($b['lastMsg']['createdAt'], $a['lastMsg']['createdAt']));
    resp(['ok' => true, 'data' => $arr]);
}

function sendReply(): void {
    $user = requireAuth();
    $b    = body();
    $companyId = $b['companyId'] ?? '';
    $text      = trim($b['text'] ?? '');
    if (!$text || !$companyId) err('Eksik veri.');

    $chk = db()->prepare('SELECT user_id, name FROM companies WHERE id = ?');
    $chk->execute([$companyId]);
    $co = $chk->fetch();
    if (!$co || $co['user_id'] !== $user['id']) err('Yetkisiz.', 403);

    $orig = db()->prepare('SELECT * FROM messages WHERE to_company_id = ? AND from_company_id IS NULL ORDER BY created_at ASC LIMIT 1');
    $orig->execute([$companyId]);
    $first = $orig->fetch();

    $id = newId('msg');
    db()->prepare('INSERT INTO messages (id,to_company_id,from_company_id,from_name,to_user_id,to_email,to_name,body,is_read) VALUES (?,?,?,?,?,?,?,?,1)')
       ->execute([$id, $companyId, $companyId, $co['name'], $first['from_user_id'] ?? null, $first['from_email'] ?? null, $first['from_name'] ?? null, $text]);

    $get = db()->prepare('SELECT * FROM messages WHERE id = ?');
    $get->execute([$id]);
    resp(['ok' => true, 'data' => fmtMsg($get->fetch())], 201);
}

function pollNew(): void {
    $user = requireAuth();
    $since     = $_GET['since'] ?? '';
    $companyId = $_GET['company_id'] ?? '';
    if (!$since) err('since gerekli.');

    $db      = db();
    $results = [];

    $stmt = $db->prepare('SELECT m.* FROM messages m
        INNER JOIN companies c ON c.id = m.to_company_id
        WHERE c.user_id = ? AND m.created_at > ? AND m.from_company_id IS NULL
        ORDER BY m.created_at ASC');
    $stmt->execute([$user['id'], $since]);
    $results = $stmt->fetchAll();

    $stmt2 = $db->prepare('SELECT * FROM messages WHERE to_user_id = ? AND created_at > ? AND from_company_id IS NOT NULL ORDER BY created_at ASC');
    $stmt2->execute([$user['id'], $since]);
    $results = array_merge($results, $stmt2->fetchAll());

    if ($companyId) {
        $stmt3 = $db->prepare('SELECT * FROM messages WHERE to_company_id = ? AND to_user_id = ? AND created_at > ? ORDER BY created_at ASC');
        $stmt3->execute([$companyId, $user['id'], $since]);
        $results = array_merge($results, $stmt3->fetchAll());
    }

    $seen = []; $unique = [];
    foreach ($results as $m) {
        if (!isset($seen[$m['id']])) { $seen[$m['id']] = true; $unique[] = $m; }
    }

    resp(['ok' => true, 'data' => array_map('fmtMsg', $unique)]);
}

function deleteThread(): void {
    $user = requireAuth();
    $b    = body();
    $threadKey = $b['threadKey'] ?? '';
    $type      = $b['type']      ?? 'in';
    if (!$threadKey) err('threadKey gerekli.');

    $db = db();

    if ($type === 'in') {
        $sep       = strpos($threadKey, '|');
        $companyId = $sep === false ? $threadKey : substr($threadKey, 0, $sep);
        $senderId  = $sep === false ? ''         : substr($threadKey, $sep + 1);
        $chk = $db->prepare('SELECT user_id FROM companies WHERE id = ?');
        $chk->execute([$companyId]);
        $co = $chk->fetch();
        if (!$co || $co['user_id'] !== $user['id']) err('Yetkisiz.', 403);

        if ($senderId === 'guest') {
            $db->prepare("DELETE FROM messages WHERE to_company_id = ? AND from_company_id IS NULL AND from_user_id IS NULL AND (from_email IS NULL OR from_email = '')")
               ->execute([$companyId]);
            $db->prepare("DELETE FROM messages WHERE to_company_id = ? AND from_company_id = ? AND to_user_id IS NULL AND (to_email IS NULL OR to_email = '')")
               ->execute([$companyId, $companyId]);
        } else {
            $db->prepare("DELETE FROM messages WHERE to_company_id = ? AND (
                (from_company_id IS NULL AND (from_user_id = ? OR (from_user_id IS NULL AND from_email = ?)))
                OR (from_company_id = ? AND (to_user_id = ? OR (to_user_id IS NULL AND to_email = ?)))
                )")->execute([$companyId, $senderId, $senderId, $companyId, $senderId, $senderId]);
        }
    } else {
        $companyId = $threadKey;
        $db->prepare('DELETE FROM messages WHERE to_company_id = ? AND from_user_id = ?')->execute([$companyId, $user['id']]);
        $db->prepare('DELETE FROM messages WHERE from_company_id = ? AND to_user_id = ?')->execute([$companyId, $user['id']]);
    }

    resp(['ok' => true]);
}