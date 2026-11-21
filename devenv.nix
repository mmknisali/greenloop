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
  dotenv.enable = true;
  env.PHP_CLI_SERVER_WORKERS = "4";

  # ── Languages ──
  languages.php.enable = true;
  languages.php.version = "8.2";
  languages.php.extensions = [ "pdo_mysql" "mysqli" "mbstring" "curl" ];

  # ── Packages ──
  packages = [ pkgs.git pkgs.mariadb pkgs.curl pkgs.jq pkgs.python3 ];

  # ── Services ──
  services.mysql.enable = true;
  services.mysql.initialDatabases = [ { name = "greenloop"; } ];
  services.mysql.settings = {
    mysqld = {
      skip-grant-tables = true;
      bind-address = "127.0.0.1";
    };
  };

  # ── Processes ──
  processes.web-server.exec = ''
    ${initDb} || exit $?
    # For phone testing only, change 127.0.0.1 to 0.0.0.0 on a trusted LAN.
    exec ${config.languages.php.package}/bin/php -S 127.0.0.1:8000 -t . router.php
  '';
  processes.web-server.restart.on = "on_failure";
  processes.web-server.ready.http.get.port = 8000;
  processes.web-server.after = [ "devenv:processes:mysql" ];

  # ── Tasks ──
  tasks."greenloop:init-db".exec = "${initDb}";
  tasks."greenloop:init-db".description = "Initialize MySQL database with GreenLoop schema and demo data";

  # ── Shell hook ──
  enterShell = ''
    echo "GreenLoop | PHP 8.2 + MariaDB"
    echo "  devenv up --detach                      Start http://127.0.0.1:8000"
    echo "  devenv tasks run greenloop:init-db      Reapply schema and demo seed"
    echo "  python3 tests/smoke_test.py             Verify a running development server"
    echo "  .env.example                           Optional DB and chat settings"
  '';
}
