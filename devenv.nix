{ pkgs, lib, config, inputs, ... }:

{
  # ── Environment variables ──
  env.GREET = "GreenLoop";

  # ── Languages ──
  languages.php.enable = true;
  languages.php.version = "8.2";
  languages.php.extensions = [ "pdo_mysql" "mysqli" ];

  # ── Packages ──
  packages = [ pkgs.git pkgs.mariadb pkgs.curl ];

  # ── Services ──
  services.mysql.enable = true;
  services.mysql.initialDatabases = [ { name = "greenloop"; } ];
  services.mysql.settings = {
    mysqld = {
      skip-grant-tables = true;
    };
  };

  # ── Processes ──
  processes.web-server.exec = ''
    exec ${config.languages.php.package}/bin/php -S 0.0.0.0:8000 -t .
  '';
  processes.web-server.restart.on = "on_failure";
  processes.web-server.ready.http.get.port = 8000;
  processes.web-server.after = [ "devenv:processes:mysql" ];

  # ── Tasks ──
  tasks."greenloop:init-db".exec = ''
    for i in $(seq 1 30); do
      MYSQL_PWD="" ${pkgs.mariadb}/bin/mysqladmin ping -u root --silent >/dev/null 2>&1 && break
      sleep 1
    done
    MYSQL_PWD="" ${pkgs.mariadb}/bin/mysql -u root -e "CREATE DATABASE IF NOT EXISTS greenloop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    MYSQL_PWD="" ${pkgs.mariadb}/bin/mysql -u root greenloop < ${./schema.sql}
  '';
  tasks."greenloop:init-db".description = "Initialize MySQL database with GreenLoop schema";
  tasks."greenloop:init-db".before = [ "devenv:enterShell" ];

  # ── Shell hook ──
  enterShell = ''
    echo "================================================"
    echo "  GreenLoop Development Environment"
    echo "================================================"
    echo ""
    echo "  Services:"
    echo "    - Web server (PHP):  http://localhost:8000"
    echo "    - MySQL:             localhost:3306 (root, no password)"
    echo ""
    echo "  Tasks:"
    echo "    devenv tasks run greenloop:init-db   - Initialize database with schema"
    echo ""
    echo "  Files:"
    echo "    schema.sql           - Database schema"
    echo "    api/                 - PHP API backend"
    echo "================================================"
    echo ""
  '';
}
