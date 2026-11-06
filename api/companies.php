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

function buildCompany(array $row): array {
    $stmt = db()->prepare('SELECT tag, type FROM company_tags WHERE company_id = ?');
    $stmt->execute([$row['id']]);
    $tags = $stmt->fetchAll();

    $row['inputs']  = array_values(array_map(fn($t) => $t['tag'], array_filter($tags, fn($t) => $t['type'] === 'input')));
    $row['outputs'] = array_values(array_map(fn($t) => $t['tag'], array_filter($tags, fn($t) => $t['type'] === 'output')));
    $row['desc']    = $row['description'] ?? '';
    $row['date']    = $row['created_at'] ? date('d.m.Y', strtotime($row['created_at'])) : '';
    $row['userId']  = $row['user_id'];
    return $row;
}

function getAll(): void {
    $rows = db()->query('SELECT * FROM companies ORDER BY created_at DESC')->fetchAll();
    resp(['ok' => true, 'data' => array_map('buildCompany', $rows)]);
}

function getOne(): void {
    $id = $_GET['id'] ?? '';
    if (!$id) err('id gerekli.');

    $stmt = db()->prepare('SELECT * FROM companies WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) err('Şirket bulunamadı.', 404);

    resp(['ok' => true, 'data' => buildCompany($row)]);
}

function getMine(): void {
    $user = requireAuth();
    $stmt = db()->prepare('SELECT * FROM companies WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$user['id']]);
    resp(['ok' => true, 'data' => array_map('buildCompany', $stmt->fetchAll())]);
}

function addCompany(): void {
    $user = requireAuth();
    $b    = body();

    $name = trim($b['name']   ?? '');
    $il   = trim($b['il']     ?? '');
    $ilce = trim($b['ilce']   ?? '');
    $sect = trim($b['sector'] ?? '');

    if (!$name) err('Şirket adı zorunludur.');
    if (!$sect) err('Sektör seçiniz.');
    if (!$il)   err('İl seçiniz.');
    if (!$ilce) err('İlçe seçiniz.');

    $id = newId('c');
    $db = db();

    $db->prepare('INSERT INTO companies
        (id,user_id,name,sector,il,ilce,size,email,tel,web,emission,description,emoji,owner_name,owner_email)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
       ->execute([
           $id, $user['id'], $name, $sect, $il, $ilce,
           $b['size']     ?? '',
           $b['email']    ?? '',
           $b['tel']      ?? '',
           $b['web']      ?? '',
           (int)($b['emission'] ?? 0),
           $b['desc']     ?? '',
           $b['emoji']    ?? '🏭',
           $user['ad'] . ' ' . $user['soyad'],
           $user['email'],
       ]);

    $tagStmt = $db->prepare('INSERT INTO company_tags (company_id, tag, type) VALUES (?,?,?)');
    foreach ((array)($b['inputs']  ?? []) as $t) if ($t) $tagStmt->execute([$id, $t, 'input']);
    foreach ((array)($b['outputs'] ?? []) as $t) if ($t) $tagStmt->execute([$id, $t, 'output']);

    $s = $db->prepare('SELECT * FROM companies WHERE id = ?');
    $s->execute([$id]);
    resp(['ok' => true, 'data' => buildCompany($s->fetch())], 201);
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