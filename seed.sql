-- Optional demo data. Run after schema.sql.
SET NAMES utf8mb4;
USE greenloop;

START TRANSACTION;

-- This reserved owner is not a login account: '!' is not a PHP password hash.
INSERT INTO users (id, ad, soyad, email, password)
VALUES ('demo-user', 'GreenLoop', 'Demo', 'demo@greenloop.invalid', '!')
ON DUPLICATE KEY UPDATE password = IF(users.id = 'demo-user', '!', users.password);

-- Keep the public demo IDs stable. Sizes use the dashboard's employee bands.
INSERT INTO companies (id, user_id, name, sector, il, ilce, size, emission, description, icon, is_demo, created_at)
VALUES
  ('demo-1', 'demo-user', 'Anadolu Geri Dönüşüm A.Ş.', 'Geri Dönüşüm', 'İstanbul', 'Tuzla', '51-200', 34, 'Kentsel plastik ve metal atıkları işleyerek ikincil hammadde üretir.', 'recycle', 1, '2025-01-01 00:00:00'),
  ('demo-2', 'demo-user', 'Marmara Tekstil Grubu', 'Tekstil', 'Bursa', 'Nilüfer', '200+', 22, 'Örme kumaş üretimi yapan entegre tekstil tesisi.', 'thread', 1, '2025-01-01 00:00:00'),
  ('demo-3', 'demo-user', 'Ege Kağıt ve Karton', 'Kağıt', 'İzmir', 'Bornova', '51-200', 28, 'Atık kağıttan oluklu mukavva üretimi.', 'package', 1, '2024-01-01 00:00:00'),
  ('demo-4', 'demo-user', 'Konya Tarım Ürünleri', 'Gıda', 'Konya', 'Selçuklu', '51-200', 18, 'Tahıl işleme ve paketleme tesisi.', 'wheat', 1, '2024-01-01 00:00:00'),
  ('demo-5', 'demo-user', 'Kayseri Mobilya San.', 'Mobilya', 'Kayseri', 'Melikgazi', '11-50', 15, 'Ahşap mobilya üretimi ve yüzey işleme.', 'construction', 1, '2023-01-01 00:00:00'),
  ('demo-6', 'demo-user', 'Adana Cam Sanayi', 'Cam', 'Adana', 'Seyhan', '51-200', 26, 'Ambalaj camı üretimi ve cam geri dönüşümü.', 'flask', 1, '2024-01-01 00:00:00'),
  ('demo-7', 'demo-user', 'Denizli Tekstil Boyahanesi', 'Tekstil', 'Denizli', 'Merkezefendi', '51-200', 20, 'Kumaş boyama ve terbiye tesisi.', 'thread', 1, '2023-01-01 00:00:00'),
  ('demo-8', 'demo-user', 'Kocaeli Petrokimya', 'Kimya', 'Kocaeli', 'Gebze', '200+', 30, 'Polimer ve petrokimya ara ürün üretimi.', 'flask', 1, '2024-01-01 00:00:00'),
  ('demo-9', 'demo-user', 'Antalya Seracılık Kooperatifi', 'Tarım', 'Antalya', 'Kumluca', '11-50', 12, 'Örtü altı sebze üretimi kooperatifi.', 'leaf', 1, '2023-01-01 00:00:00'),
  ('demo-10', 'demo-user', 'Mersin Liman Lojistik', 'Lojistik', 'Mersin', 'Akdeniz', '51-200', 16, 'Liman ardı depolama ve dağıtım hizmetleri.', 'truck', 1, '2024-01-01 00:00:00'),
  ('demo-11', 'demo-user', 'Sakarya Otomotiv Yan Sanayi', 'Otomotiv', 'Sakarya', 'Erenler', '200+', 24, 'Otomotiv yedek parça ve enjeksiyon üretimi.', 'component', 1, '2024-01-01 00:00:00'),
  ('demo-12', 'demo-user', 'Manisa Elektronik Geri Kazanım', 'Elektronik', 'Manisa', 'Yunusemre', '51-200', 33, 'E-atık toplama ve değerli metal geri kazanımı.', 'battery', 1, '2025-01-01 00:00:00'),
  ('demo-13', 'demo-user', 'Eskişehir Seramik San.', 'Seramik', 'Eskişehir', 'Odunpazarı', '51-200', 19, 'Yer ve duvar seramiği üretimi.', 'brick', 1, '2023-01-01 00:00:00'),
  ('demo-14', 'demo-user', 'Trabzon Çay ve Gıda', 'Gıda', 'Trabzon', 'Akçaabat', '11-50', 14, 'Çay işleme ve paketleme fabrikası.', 'coffee', 1, '2023-01-01 00:00:00'),
  ('demo-15', 'demo-user', 'Şanlıurfa Tekstil Fabrikası', 'Tekstil', 'Şanlıurfa', 'Haliliye', '51-200', 21, 'İplik ve dokuma üretimi.', 'thread', 1, '2024-01-01 00:00:00'),
  ('demo-16', 'demo-user', 'Malatya Kayısı İşleme', 'Gıda', 'Malatya', 'Yeşilyurt', '11-50', 17, 'Kuru kayısı işleme ve paketleme.', 'wheat', 1, '2023-01-01 00:00:00'),
  ('demo-17', 'demo-user', 'Samsun Kimya Endüstrisi', 'Kimya', 'Samsun', 'İlkadım', '51-200', 27, 'Endüstriyel kimyasal üretim tesisi.', 'barrel', 1, '2024-01-01 00:00:00'),
  ('demo-18', 'demo-user', 'Diyarbakır Enerji Santrali', 'Enerji', 'Diyarbakır', 'Kayapınar', '200+', 40, 'Biyokütle atıklarından enerji üretimi.', 'energy', 1, '2025-01-01 00:00:00'),
  ('demo-19', 'demo-user', 'Kahramanmaraş Metal İşleme', 'Metal', 'Kahramanmaraş', 'Onikişubat', '51-200', 23, 'Metal döküm ve talaşlı imalat.', 'factory', 1, '2024-01-01 00:00:00'),
  ('demo-20', 'demo-user', 'Gaziantep Plastik Geri Dönüşüm', 'Plastik', 'Gaziantep', 'Şahinbey', '51-200', 31, 'Ambalaj ve lastik atığından granül plastik üretimi.', 'recycle', 1, '2025-01-01 00:00:00')
ON DUPLICATE KEY UPDATE id = companies.id;

CREATE TEMPORARY TABLE gl_seed_tags (
  position   INT AUTO_INCREMENT PRIMARY KEY,
  company_id VARCHAR(64) NOT NULL,
  tag        VARCHAR(190) NOT NULL,
  type       ENUM('input','output') NOT NULL
) ENGINE=InnoDB;

INSERT INTO gl_seed_tags (company_id, tag, type) VALUES
  ('demo-1', 'Plastik Atık', 'input'),
  ('demo-1', 'Metal Hurda', 'input'),
  ('demo-1', 'Granül Plastik', 'output'),
  ('demo-1', 'Metal İngot', 'output'),
  ('demo-2', 'Pamuk', 'input'),
  ('demo-2', 'Granül Plastik', 'input'),
  ('demo-2', 'Tekstil Atığı', 'output'),
  ('demo-2', 'Boya Çamuru', 'output'),
  ('demo-3', 'Kağıt/Karton Atık', 'input'),
  ('demo-3', 'Geri Dönüştürülmüş Karton', 'output'),
  ('demo-3', 'Kağıt Çamuru', 'output'),
  ('demo-4', 'Su', 'input'),
  ('demo-4', 'Gübre', 'input'),
  ('demo-4', 'Organik Atık', 'output'),
  ('demo-4', 'Saman', 'output'),
  ('demo-5', 'Saman', 'input'),
  ('demo-5', 'Ahşap Talaşı', 'input'),
  ('demo-5', 'Ahşap Talaşı', 'output'),
  ('demo-5', 'Mobilya Atığı', 'output'),
  ('demo-6', 'Cam Kırığı', 'input'),
  ('demo-6', 'Cam Kırığı', 'output'),
  ('demo-6', 'Cam Tozu', 'output'),
  ('demo-7', 'Tekstil Atığı', 'input'),
  ('demo-7', 'Boya Çamuru', 'output'),
  ('demo-7', 'Atık Su', 'output'),
  ('demo-8', 'Kullanılmış Yağ', 'input'),
  ('demo-8', 'Plastik Atık', 'output'),
  ('demo-8', 'Kimyasal Çamur', 'output'),
  ('demo-9', 'Organik Atık', 'input'),
  ('demo-9', 'Kül', 'input'),
  ('demo-9', 'Sebze Atığı', 'output'),
  ('demo-9', 'Bitki Sapı', 'output'),
  ('demo-10', 'Ahşap Palet', 'input'),
  ('demo-10', 'Ahşap Palet Atığı', 'output'),
  ('demo-10', 'Plastik Ambalaj', 'output'),
  ('demo-11', 'Metal Hurda', 'input'),
  ('demo-11', 'Plastik Atık', 'input'),
  ('demo-11', 'Metal Talaşı', 'output'),
  ('demo-11', 'Lastik Atığı', 'output'),
  ('demo-12', 'Elektronik Atık', 'input'),
  ('demo-12', 'Devre Kartı Hurdası', 'output'),
  ('demo-12', 'Plastik Atık', 'output'),
  ('demo-13', 'Cam Tozu', 'input'),
  ('demo-13', 'Kül', 'input'),
  ('demo-13', 'Seramik Atığı', 'output'),
  ('demo-13', 'Kil Çamuru', 'output'),
  ('demo-14', 'Su', 'input'),
  ('demo-14', 'Çay Posası', 'output'),
  ('demo-14', 'Organik Atık', 'output'),
  ('demo-15', 'Pamuk', 'input'),
  ('demo-15', 'Tekstil Atığı', 'output'),
  ('demo-15', 'Pamuk Sapı', 'output'),
  ('demo-16', 'Su', 'input'),
  ('demo-16', 'Kayısı Çekirdeği', 'output'),
  ('demo-16', 'Organik Atık', 'output'),
  ('demo-17', 'Kimyasal Çamur', 'input'),
  ('demo-17', 'Kullanılmış Yağ', 'output'),
  ('demo-17', 'Asit Atığı', 'output'),
  ('demo-18', 'Çay Posası', 'input'),
  ('demo-18', 'Ahşap Talaşı', 'input'),
  ('demo-18', 'Pamuk Sapı', 'input'),
  ('demo-18', 'Kül', 'output'),
  ('demo-18', 'Isı Enerjisi', 'output'),
  ('demo-19', 'Metal Talaşı', 'input'),
  ('demo-19', 'Metal İngot', 'input'),
  ('demo-19', 'Metal Hurda', 'output'),
  ('demo-19', 'Metal Tozu', 'output'),
  ('demo-20', 'Plastik Ambalaj', 'input'),
  ('demo-20', 'Lastik Atığı', 'input'),
  ('demo-20', 'Granül Plastik', 'output'),
  ('demo-20', 'Plastik Atık', 'output');

-- Insert only missing tags on seeded companies, keeping existing tag IDs intact.
INSERT INTO company_tags (company_id, tag, type)
SELECT s.company_id, s.tag, s.type
FROM gl_seed_tags s
JOIN companies c ON c.id = s.company_id AND c.user_id = 'demo-user' AND c.is_demo = 1
LEFT JOIN company_tags t ON t.company_id = s.company_id AND t.tag = s.tag AND t.type = s.type
WHERE t.id IS NULL
ORDER BY s.position;

DROP TEMPORARY TABLE gl_seed_tags;
COMMIT;
