<?php
declare(strict_types=1);

require_once __DIR__ . '/companies.php';

// Province centers from assets/js/network.js, as [latitude, longitude].
const MATCH_PROVINCE_COORDS = [
    'Adana' => [37.00, 35.32], 'Adıyaman' => [37.76, 38.27], 'Afyonkarahisar' => [38.75, 30.54],
    'Ağrı' => [39.72, 43.05], 'Amasya' => [40.65, 35.83], 'Ankara' => [39.92, 32.85],
    'Antalya' => [36.89, 30.71], 'Ardahan' => [41.11, 42.70], 'Artvin' => [41.18, 41.82],
    'Aydın' => [37.84, 27.84], 'Balıkesir' => [39.64, 27.88], 'Bartın' => [41.63, 32.34],
    'Batman' => [37.88, 41.13], 'Bayburt' => [40.26, 40.23], 'Bilecik' => [40.14, 29.98],
    'Bingöl' => [38.88, 40.50], 'Bitlis' => [38.40, 42.12], 'Bolu' => [40.73, 31.60],
    'Burdur' => [37.72, 30.29], 'Bursa' => [40.19, 29.06], 'Çanakkale' => [40.15, 26.41],
    'Çankırı' => [40.60, 33.62], 'Çorum' => [40.55, 34.95], 'Denizli' => [37.77, 29.09],
    'Diyarbakır' => [37.91, 40.23], 'Düzce' => [40.84, 31.16], 'Edirne' => [41.68, 26.56],
    'Elazığ' => [38.67, 39.22], 'Erzincan' => [39.75, 39.49], 'Erzurum' => [39.91, 41.27],
    'Eskişehir' => [39.78, 30.52], 'Gaziantep' => [37.07, 37.38], 'Giresun' => [40.92, 38.39],
    'Gümüşhane' => [40.46, 39.48], 'Hakkari' => [37.57, 43.74], 'Hatay' => [36.40, 36.35],
    'Iğdır' => [39.89, 44.05], 'Isparta' => [37.76, 30.55], 'İstanbul' => [41.01, 28.96],
    'İzmir' => [38.42, 27.13], 'Kahramanmaraş' => [37.59, 36.94], 'Karabük' => [41.20, 32.62],
    'Karaman' => [37.18, 33.22], 'Kars' => [40.61, 43.10], 'Kastamonu' => [41.38, 33.78],
    'Kayseri' => [38.73, 35.49], 'Kırıkkale' => [39.85, 33.51], 'Kırklareli' => [41.73, 27.23],
    'Kırşehir' => [39.15, 34.17], 'Kilis' => [36.72, 37.12], 'Kocaeli' => [40.76, 29.92],
    'Konya' => [37.87, 32.49], 'Kütahya' => [39.42, 29.99], 'Malatya' => [38.35, 38.31],
    'Manisa' => [38.62, 27.43], 'Mardin' => [37.31, 40.74], 'Mersin' => [36.81, 34.64],
    'Muğla' => [37.21, 28.36], 'Muş' => [38.73, 41.49], 'Nevşehir' => [38.62, 34.72],
    'Niğde' => [37.97, 34.68], 'Ordu' => [40.98, 37.88], 'Osmaniye' => [37.07, 36.25],
    'Rize' => [41.03, 40.52], 'Sakarya' => [40.78, 30.40], 'Samsun' => [41.29, 36.33],
    'Siirt' => [37.93, 41.95], 'Sinop' => [42.03, 35.15], 'Sivas' => [39.75, 37.01],
    'Şanlıurfa' => [37.16, 38.79], 'Şırnak' => [37.52, 42.46], 'Tekirdağ' => [40.98, 27.51],
    'Tokat' => [40.32, 36.55], 'Trabzon' => [41.00, 39.73], 'Tunceli' => [39.11, 39.55],
    'Uşak' => [38.68, 29.41], 'Van' => [38.49, 43.38], 'Yalova' => [40.65, 29.27],
    'Yozgat' => [39.82, 34.81], 'Zonguldak' => [41.45, 31.80],
];

function normalizeTag(string $tag): string {
    $tag = preg_replace('/(*UCP)\s+/u', ' ', $tag);
    if ($tag === null) return '';

    $tag = mb_strtolower(strtr(trim($tag), ['I' => 'ı', 'İ' => 'i', "I\u{0307}" => 'i']), 'UTF-8');
    return strtr(preg_replace('/\p{M}+/u', '', $tag), [
        'ı' => 'i', 'ç' => 'c', 'ğ' => 'g', 'ö' => 'o', 'ş' => 's', 'ü' => 'u',
        'â' => 'a', 'î' => 'i', 'û' => 'u',
    ]);
}

/** Rounded great-circle distance between province centers; null for an unknown province. */
function haversine(string $fromProvince, string $toProvince): ?int {
    static $coordinates = [];
    if (!$coordinates) {
        foreach (MATCH_PROVINCE_COORDS as $province => $point) {
            $coordinates[normalizeTag($province)] = $point;
        }
    }

    $from = $coordinates[normalizeTag($fromProvince)] ?? null;
    $to = $coordinates[normalizeTag($toProvince)] ?? null;
    if ($from === null || $to === null) return null;

    $dLat = deg2rad($to[0] - $from[0]);
    $dLon = deg2rad($to[1] - $from[1]);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($from[0])) * cos(deg2rad($to[0])) * sin($dLon / 2) ** 2;
    return (int) round(6371 * 2 * asin(sqrt(min(1.0, $a))));
}

/** Index normalized tags by their first raw spelling, to avoid counting equivalent tags twice. */
function matchTagMap(array $rawTags): array {
    $tags = [];
    foreach ($rawTags as $rawTag) {
        $tag = normalizeTag($rawTag);
        if ($tag !== '') $tags[$tag] ??= $rawTag;
    }
    return $tags;
}

function matchReasons(array $outputs, array $inputs, ?int $km): array {
    $reasons = [];
    foreach (array_intersect_key($outputs, $inputs) as $tag => $rawOutput) {
        $reasons[] = ['tag' => (string) $tag, 'from' => $rawOutput, 'to' => $inputs[$tag], 'km' => $km];
    }
    return $reasons;
}

function matchScore(int $reasonCount, ?int $km, array $from = [], array $to = []): int {
    // The proximity bonus can't outweigh a material match.
    $sector = normalizeTag($from['sector'] ?? '');
    $sameSector = $sector !== '' && $sector === normalizeTag($to['sector'] ?? '');
    return 100 * $reasonCount + ($km === null ? 0 : max(0, 94 - intdiv($km, 20))) + ($sameSector ? 5 : 0);
}

function rankMatches(array $matches): array {
    usort($matches, static fn(array $a, array $b): int =>
        ($b['score'] <=> $a['score']) ?: strcmp($a['company']['id'], $b['company']['id']));
    return $matches;
}

/** One ranked hit per partner, with reasons in both directions; null for an unknown company. */
function matchesForCompany(array $companies, string $companyId): ?array {
    $byId = array_column($companies, null, 'id');
    $company = $byId[$companyId] ?? null;
    if ($company === null) return null;

    $inputs = matchTagMap($company['inputs']);
    $outputs = matchTagMap($company['outputs']);
    $matches = [];
    foreach ($companies as $partner) {
        if ($partner['id'] === $companyId) continue;

        $km = haversine($company['il'] ?? '', $partner['il'] ?? '');
        $reasons = array_merge(
            matchReasons($outputs, matchTagMap($partner['inputs']), $km),
            matchReasons(matchTagMap($partner['outputs']), $inputs, $km),
        );
        if ($reasons) {
            $matches[] = ['company' => $partner, 'score' => matchScore(count($reasons), $km, $company, $partner), 'reasons' => $reasons];
        }
    }
    return rankMatches($matches);
}

/** One edge per ordered producer/consumer pair, regardless of the number of matching tags. */
function matchNetwork(array $companies): array {
    $byId = array_column($companies, null, 'id');
    $inputsById = $consumersByTag = [];
    foreach ($companies as $company) {
        $id = $company['id'];
        $inputsById[$id] = matchTagMap($company['inputs']);
        foreach ($inputsById[$id] as $tag => $rawTag) {
            $consumersByTag[$tag][] = $id;
        }
    }

    $edges = [];
    foreach ($companies as $producer) {
        $fromId = $producer['id'];
        $outputs = matchTagMap($producer['outputs']);
        $targets = [];
        foreach ($outputs as $tag => $rawTag) {
            foreach ($consumersByTag[$tag] ?? [] as $toId) {
                if ($fromId !== $toId) $targets[$toId] = $toId;
            }
        }
        foreach ($targets as $toId) {
            $km = haversine($producer['il'] ?? '', $byId[$toId]['il'] ?? '');
            $reasons = matchReasons($outputs, $inputsById[$toId], $km);
            $edges[] = [
                'fromId' => $fromId, 'toId' => $toId,
                'score' => matchScore(count($reasons), $km, $producer, $byId[$toId]), 'reasons' => $reasons,
            ];
        }
    }
    return ['edges' => $edges];
}

/**
 * Search public companies for any supplied normalized tag. Type selects the company
 * side: 'input' finds consumers, 'output' finds producers, and 'both' finds either.
 * Optional query labels are keyed by normalized tag; without one, use the normalized text.
 *
 * @param list<string> $normalizedTags Tags already processed by normalizeTag().
 */
function searchMatches(array $companies, array $normalizedTags, string $type = 'both', array $queryLabels = []): array {
    if (!in_array($type, ['input', 'output', 'both'], true)) {
        throw new InvalidArgumentException('Geçersiz atık türü.');
    }
    $query = [];
    foreach ($normalizedTags as $tag) {
        if ($tag !== '') $query[$tag] = $queryLabels[$tag] ?? $tag;
    }
    if (!$query) return [];

    $matches = [];
    foreach ($companies as $company) {
        $reasons = [];
        if ($type !== 'output') $reasons = matchReasons($query, matchTagMap($company['inputs']), null);
        if ($type !== 'input') {
            $reasons = array_merge($reasons, matchReasons(matchTagMap($company['outputs']), $query, null));
        }
        if ($reasons) {
            $matches[] = ['company' => $company, 'score' => matchScore(count($reasons), null), 'reasons' => $reasons];
        }
    }
    return rankMatches($matches);
}

function matchCompanyRequest(): array {
    $id = str($_GET, 'id');
    if ($id === '') err('Şirket ID gerekli.');
    return matchesForCompany(loadPublicCompanies(), $id) ?? err('Şirket bulunamadı.', 404);
}

function matchSearchRequest(): array {
    $waste = $_GET['waste'] ?? '';
    $tag = is_string($waste) ? normalizeTag($waste) : '';
    if ($tag === '') err('Atık etiketi gerekli.');

    $type = $_GET['type'] ?? 'both';
    if (!in_array($type, ['input', 'output', 'both'], true)) err('Geçersiz atık türü.');
    return searchMatches(loadPublicCompanies(), [$tag], $type, [$tag => $waste]);
}

function platformStats(?array $companies = null, ?array $edges = null): array {
    $companies ??= loadPublicCompanies();
    $edges ??= matchNetwork($companies)['edges'];

    $outputs = $inputs = $sectors = $provinces = $participants = [];
    $demoCount = 0;
    foreach ($companies as $company) {
        if (!empty($company['isDemo'])) ++$demoCount;
        if (($company['sector'] ?? '') !== '') $sectors[normalizeTag($company['sector'])] = true;
        if (($company['il'] ?? '') !== '') $provinces[normalizeTag($company['il'])] = true;
        foreach (matchTagMap($company['outputs']) as $tag => $_) $outputs[$tag] = true;
        foreach (matchTagMap($company['inputs']) as $tag => $_) $inputs[$tag] = true;
    }
    foreach ($edges as $edge) {
        $participants[$edge['fromId']] = $participants[$edge['toId']] = true;
    }

    $materials = [];
    foreach ($edges as $edge) {
        foreach ($edge['reasons'] as $reason) {
            $tag = $reason['tag'];
            $materials[$tag] ??= ['etiket' => $reason['from'], 'normalize' => $tag, 'eslesme' => 0];
            ++$materials[$tag]['eslesme'];
        }
    }
    $materials = array_values($materials);
    usort($materials, static fn(array $a, array $b): int =>
        ($b['eslesme'] <=> $a['eslesme']) ?: strcmp($a['normalize'], $b['normalize']));

    return [
        'sirket' => count($companies),
        'demoSirket' => $demoCount,
        'sektor' => count($sectors),
        'il' => count($provinces),
        'atikTuru' => count($outputs),
        'hammaddeTuru' => count($inputs),
        'eslesme' => count($edges),
        'eslesenSirket' => count($participants),
        'onemliAtiklar' => array_map(static fn(array $m): array => [
            'etiket' => $m['etiket'], 'eslesme' => $m['eslesme'],
        ], array_slice($materials, 0, 6)),
    ];
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    require_once __DIR__ . '/config.php';

    $action = $_GET['action'] ?? '';
    if (!in_array($action, ['for_company', 'network', 'search', 'stats'], true)) err('Geçersiz işlem.', 404);
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        header('Allow: GET');
        err('Geçersiz istek yöntemi.', 405);
    }

    $data = match ($action) {
        'for_company' => matchCompanyRequest(),
        'network'     => matchNetwork(loadPublicCompanies()),
        'search'      => matchSearchRequest(),
        'stats'       => platformStats(),
    };
    resp(['ok' => true, 'data' => $data]);
}
