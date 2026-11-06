<?php
require __DIR__ . '/config.php';

$action = $_GET['action'] ?? '';

match ($action) {
    'register' => handleRegister(),
    'login'    => handleLogin(),
    'logout'   => handleLogout(),
    'me'       => handleMe(),
    default    => err('Geçersiz işlem.', 404),
};

function handleRegister(): void {
    $b     = body();
    $ad    = trim($b['ad']       ?? '');
    $soyad = trim($b['soyad']    ?? '');
    $email = trim($b['email']    ?? '');
    $tel   = trim($b['tel']      ?? '');
    $pass  = $b['password']      ?? '';

    if (!$ad || !$soyad || !$email || !$pass) err('Zorunlu alanları doldurun.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) err('Geçerli bir e-posta girin.');
    if (strlen($pass) < 6) err('Şifre en az 6 karakter olmalı.');

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
    $_SESSION['user'] = $user;
    resp(['ok' => true, 'user' => $user]);
}

function handleLogin(): void {
    $b     = body();
    $email = trim($b['email']    ?? '');
    $pass  = $b['password']      ?? '';

    if (!$email || !$pass) err('E-posta ve şifre gerekli.');

    $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($pass, $row['password'])) err('E-posta veya şifre hatalı.');

    $user = ['id' => $row['id'], 'ad' => $row['ad'], 'soyad' => $row['soyad'], 'email' => $row['email'], 'tel' => $row['tel']];
    $_SESSION['user'] = $user;
    resp(['ok' => true, 'user' => $user]);
}

function handleLogout(): void {
    session_destroy();
    resp(['ok' => true]);
}

function handleMe(): void {
    if (empty($_SESSION['user'])) resp(['ok' => false, 'user' => null]);
    resp(['ok' => true, 'user' => $_SESSION['user']]);
}