<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

match ($action) {
    'all'    => getAll(),
    'get'    => getOne(),
    'mine'   => getMine(),
    'add'    => addCompany(),
    'delete' => deleteCompany(),
    default  => err('Geçersiz işlem.', 404),
};

/**
 * Shapes company rows for the API, attaching their tags. Tags for the whole
 * list come back in one query (not one query per company).
 *
 * The owner's login email and name are included only for the owner's own
 * listing (mine); public listings leave them out.
 */
function buildCompanies(array $rows, bool $withOwnerContact): array {
    if (!$rows) return [];

    $ids  = array_column($rows, 'id');
    $in   = implode(',', array_fill(0, count($ids), '?'));
    $stmt = db()->prepare("SELECT company_id, tag, type FROM company_tags WHERE company_id IN ($in) ORDER BY id");
    $stmt->execute($ids);

    $tags = [];
    foreach ($stmt->fetchAll() as $t) {
        $tags[$t['company_id']][$t['type']][] = $t['tag'];
    }

    return array_map(function (array $row) use ($tags, $withOwnerContact): array {
        $own = $tags[$row['id']] ?? [];
        $row['inputs']  = $own['input']  ?? [];
        $row['outputs'] = $own['output'] ?? [];
        $row['desc']    = $row['description'] ?? '';
        $row['date']    = $row['created_at'] ? date('d.m.Y', strtotime($row['created_at'])) : '';
        $row['userId']  = $row['user_id'];
        if (!$withOwnerContact) {
            unset($row['owner_name'], $row['owner_email']);
        }
        return $row;
    }, $rows);
}

function getAll(): void {
    $rows = db()->query('SELECT * FROM companies ORDER BY created_at DESC')->fetchAll();
    resp(['ok' => true, 'data' => buildCompanies($rows, false)]);
}

function getOne(): void {
    $id = $_GET['id'] ?? '';
    if (!$id) err('id gerekli.');

    $stmt = db()->prepare('SELECT * FROM companies WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) err('Şirket bulunamadı.', 404);

    resp(['ok' => true, 'data' => buildCompanies([$row], false)[0]]);
}

function getMine(): void {
    $user = requireAuth();
    $stmt = db()->prepare('SELECT * FROM companies WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$user['id']]);
    resp(['ok' => true, 'data' => buildCompanies($stmt->fetchAll(), true)]);
}

function addCompany(): void {
    $user = requireAuth();
    $b    = body();

    $name  = str($b, 'name');
    $il    = str($b, 'il');
    $ilce  = str($b, 'ilce');
    $sect  = str($b, 'sector');
    $size  = str($b, 'size');
    $email = str($b, 'email');
    $tel   = str($b, 'tel');
    $web   = str($b, 'web');
    $desc  = str($b, 'desc');
    $emoji = str($b, 'emoji') ?: '🏭';
    $emission = max(0, (int)($b['emission'] ?? 0));

    if (!$name) err('Şirket adı zorunludur.');
    if (!$sect) err('Sektör seçiniz.');
    if (!$il)   err('İl seçiniz.');
    if (!$ilce) err('İlçe seçiniz.');

    maxLen($name, 190, 'Şirket adı');
    maxLen($sect, 100, 'Sektör');
    maxLen($il, 100, 'İl');
    maxLen($ilce, 100, 'İlçe');
    maxLen($size, 50, 'Çalışan sayısı');
    maxLen($email, 190, 'Şirket e-postası');
    maxLen($tel, 30, 'Telefon');
    maxLen($web, 190, 'Web adresi');
    maxLen($desc, 5000, 'Açıklama');
    maxLen($emoji, 50, 'Simge');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) err('Geçerli bir şirket e-postası girin.');

    // Tags: inputs and outputs, each a short non-empty string.
    $tagRows = [];
    foreach (['input' => 'inputs', 'output' => 'outputs'] as $type => $key) {
        $list = is_array($b[$key] ?? null) ? $b[$key] : [];
        foreach ($list as $t) {
            $t = is_scalar($t) ? trim((string)$t) : '';
            if ($t === '') continue;
            maxLen($t, 190, 'Etiket');
            $tagRows[] = [$t, $type];
        }
    }

    $id = newId('c');
    $db = db();
    $db->beginTransaction();
    try {
        $db->prepare('INSERT INTO companies
            (id,user_id,name,sector,il,ilce,size,email,tel,web,emission,description,emoji,owner_name,owner_email)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
           ->execute([
               $id, $user['id'], $name, $sect, $il, $ilce, $size, $email, $tel, $web,
               $emission, $desc, $emoji,
               $user['ad'] . ' ' . $user['soyad'],
               $user['email'],
           ]);

        $tagStmt = $db->prepare('INSERT INTO company_tags (company_id, tag, type) VALUES (?,?,?)');
        foreach ($tagRows as [$tag, $type]) {
            $tagStmt->execute([$id, $tag, $type]);
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    $s = $db->prepare('SELECT * FROM companies WHERE id = ?');
    $s->execute([$id]);
    resp(['ok' => true, 'data' => buildCompanies([$s->fetch()], true)[0]], 201);
}

function deleteCompany(): void {
    $user = requireAuth();
    $id   = $_GET['id'] ?? '';
    if (!$id) err('id gerekli.');

    $stmt = db()->prepare('SELECT user_id FROM companies WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();

    if (!$row)                         err('Şirket bulunamadı.', 404);
    if ($row['user_id'] !== $user['id']) err('Bu şirketi silme yetkiniz yok.', 403);

    db()->prepare('DELETE FROM companies WHERE id = ?')->execute([$id]);
    resp(['ok' => true]);
}
