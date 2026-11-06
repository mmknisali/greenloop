<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: http://localhost');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// Database settings. The defaults match the devenv setup; a deployment overrides
// them with environment variables instead of editing this file.
define('DB_HOST', getenv('GREENLOOP_DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('GREENLOOP_DB_NAME') ?: 'greenloop');
define('DB_USER', getenv('GREENLOOP_DB_USER') ?: 'root');
define('DB_PASS', getenv('GREENLOOP_DB_PASS') ?: '');
define('DB_CHARSET', 'utf8mb4');

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

session_start();

function resp(mixed $data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function err(string $msg, int $code = 400): never {
    resp(['ok' => false, 'msg' => $msg], $code);
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
    if (mb_strlen($value) > $max) err($label . ' en fazla ' . $max . ' karakter olabilir.');
}

function requireAuth(): array {
    if (empty($_SESSION['user'])) err('Oturum açmanız gerekiyor.', 401);
    return $_SESSION['user'];
}

function newId(string $prefix = 'id'): string {
    return $prefix . '_' . uniqid('', true);
}