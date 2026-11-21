<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';
$method = $action === 'me' ? 'GET' : 'POST';
if (in_array($action, ['register', 'login', 'logout', 'me'], true) && $_SERVER['REQUEST_METHOD'] !== $method) {
    header('Allow: ' . $method);
    err('Geçersiz istek yöntemi.', 405);
}

match ($action) {
    'register' => handleRegister(),
    'login'    => handleLogin(),
    'logout'   => handleLogout(),
    'me'       => handleMe(),
    default    => err('Geçersiz işlem.', 404),
};

function handleRegister(): void {
    rateLimit('register:' . requestIp(), 30, 600);
    $b     = body();
    $ad    = str($b, 'ad');
    $soyad = str($b, 'soyad');
    $email = str($b, 'email');
    $tel   = str($b, 'tel');
    $pass  = is_string($b['password'] ?? null) ? $b['password'] : '';

    if (!$ad || !$soyad || !$email || !$pass) err('Zorunlu alanları doldurun.');
    maxLen($ad, 100, 'Ad');
    maxLen($soyad, 100, 'Soyad');
    maxLen($email, 190, 'E-posta');
    maxLen($tel, 30, 'Telefon');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) err('Geçerli bir e-posta girin.');
    if (strlen($pass) < 6) err('Şifre en az 6 karakter olmalı.');
    if (strlen($pass) > 72) err('Şifre en fazla 72 karakter olabilir.'); // bcrypt ignores anything past 72 bytes

    $chk = db()->prepare('SELECT id FROM users WHERE email = ?');
    $chk->execute([$email]);
    if ($chk->fetch()) err('Bu e-posta zaten kayıtlı.');

    $id   = newId('u');
    $hash = password_hash($pass, PASSWORD_BCRYPT);
    try {
        db()->prepare('INSERT INTO users (id,ad,soyad,email,tel,password) VALUES (?,?,?,?,?,?)')
           ->execute([$id, $ad, $soyad, $email, $tel, $hash]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') err('Bu e-posta zaten kayıtlı.', 409);
        throw $e;
    }

    $user = ['id' => $id, 'ad' => $ad, 'soyad' => $soyad, 'email' => $email, 'tel' => $tel];
    startSession($user);
    resp(['ok' => true, 'data' => $user]);
}

function handleLogin(): void {
    rateLimit('login:' . requestIp(), 30, 600);
    $b     = body();
    $email = str($b, 'email');
    $pass  = is_string($b['password'] ?? null) ? $b['password'] : '';

    if (!$email || !$pass) err('E-posta ve şifre gerekli.');
    maxLen($email, 190, 'E-posta');

    $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($pass, $row['password'])) err('E-posta veya şifre hatalı.');

    $user = ['id' => $row['id'], 'ad' => $row['ad'], 'soyad' => $row['soyad'], 'email' => $row['email'], 'tel' => $row['tel']];
    startSession($user);
    resp(['ok' => true, 'data' => $user]);
}

/**
 * Starts a fresh session for a user who has just proved who they are.
 * A new session id on login stops a session id planted before login from
 * being used after it (session fixation).
 */
function startSession(array $user): void {
    session_regenerate_id(true);
    $_SESSION['user'] = $user;
}

function handleLogout(): void {
    $_SESSION = [];
    session_destroy();
    resp(['ok' => true, 'data' => null]);
}

function handleMe(): void {
    if (empty($_SESSION['user']) && previewAdminEnabled()) {
        $demo = db()->query("SELECT id, email, tel FROM users WHERE id = 'demo-user' AND password = '!' LIMIT 1")->fetch();
        if ($demo) {
            startSession($demo + ['ad' => 'Önizleme', 'soyad' => 'Yöneticisi', 'previewAdmin' => true]);
        }
    }
    resp(['ok' => true, 'data' => $_SESSION['user'] ?? null]);
}
