<?php
declare(strict_types=1);

// PHP's dev server otherwise serves any file under the repository root, including .env.
$path = explode('?', $_SERVER['REQUEST_URI'], 2)[0];
if (in_array($path, [
    '/', '/index.html', '/login.html', '/dashboard.html', '/network.html', '/company-detail.html',
    '/api.js', '/tr-data.js', '/icons.js',
    '/api/auth.php', '/api/companies.php', '/api/messages.php', '/api/matches.php', '/api/chat.php',
], true) || preg_match('~^/assets/(?:css/[a-z-]+\.css|js/[a-z-]+\.js|fonts/[a-z-]+\.woff2)$~D', $path)) {
    return false;
}

http_response_code(404);
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['ok' => false, 'msg' => 'Sayfa bulunamadı.'], JSON_UNESCAPED_UNICODE);
