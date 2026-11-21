{ pkgs, config, ... }:
let
  initDb = pkgs.writeShellScript "greenloop-init-db" ''
    set -e
    for i in $(seq 1 30); do
      ${pkgs.mariadb}/bin/mariadb-admin ping -u root --silent >/dev/null 2>&1 && break
      sleep 1
    done
    ${pkgs.mariadb}/bin/mariadb -u root < ${./schema.sql}
    ${pkgs.mariadb}/bin/mariadb -u root < ${./seed.sql}
  '';
in
{
  # ── Environment variables ──
  env.GREET = "GreenLoop";

  # ── Languages ──
  languages.php.enable = true;
  languages.php.version = "8.2";
  languages.php.extensions = [ "pdo_mysql" "mysqli" "mbstring" ];

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
    ${initDb} || exit $?
    exec ${config.languages.php.package}/bin/php -S 127.0.0.1:8000 -t .
  '';
  processes.web-server.restart.on = "on_failure";
  processes.web-server.ready.http.get.port = 8000;
  processes.web-server.after = [ "devenv:processes:mysql" ];

  # ── Tasks ──
  tasks."greenloop:init-db".exec = "${initDb}";
  tasks."greenloop:init-db".description = "Initialize MySQL database with GreenLoop schema and demo data";

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
    echo "    devenv tasks run greenloop:init-db   - Initialize database with schema and demo data"
    echo ""
    echo "  Files:"
    echo "    schema.sql           - Database schema"
    echo "    seed.sql             - Demo companies and tags"
    echo "    api/                 - PHP API backend"
    echo "================================================"
    echo ""
  '';
}
