import re
from django.core.management.base import BaseCommand
from django.db import connection


UUID_REGEX = r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'


class Command(BaseCommand):
    help = "Normalize UUID columns in MySQL from 36-char hyphenated format to 32-char hex"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Report tables and rows with hyphens without modifying data',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        self.stdout.write(self.style.NOTICE("Scanning MySQL database for UUID columns with hyphens..."))

        total_updated = 0
        with connection.cursor() as cursor:
            db_name = connection.settings_dict['NAME']
            cursor.execute("""
                SELECT TABLE_NAME, COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s
                  AND DATA_TYPE IN ('char', 'varchar')
                  AND CHARACTER_MAXIMUM_LENGTH >= 36
                  AND (COLUMN_NAME = 'id' OR COLUMN_NAME LIKE '%%_id')
            """, [db_name])
            candidates = cursor.fetchall()

            tables_to_update = []
            for table_name, column_name in candidates:
                try:
                    cursor.execute(f"""
                        SELECT COUNT(*)
                        FROM `{table_name}`
                        WHERE `{column_name}` REGEXP '{UUID_REGEX}'
                    """)
                    count = cursor.fetchone()[0]
                    if count > 0:
                        tables_to_update.append((table_name, column_name, count))
                        self.stdout.write(f"  Found {count} hyphenated UUIDs in {table_name}.{column_name}")
                except Exception:
                    continue

            if not tables_to_update:
                self.stdout.write(self.style.SUCCESS("No hyphenated UUIDs found in database. All UUID fields are clean!"))
                return

            if dry_run:
                self.stdout.write(self.style.WARNING(f"\n[DRY RUN] {len(tables_to_update)} columns would be normalized."))
                return

            self.stdout.write(self.style.NOTICE("\nNormalizing UUID columns (disabling foreign key checks temporarily)..."))
            cursor.execute("SET FOREIGN_KEY_CHECKS = 0;")
            try:
                for table_name, column_name, count in tables_to_update:
                    cursor.execute(f"""
                        UPDATE `{table_name}`
                        SET `{column_name}` = REPLACE(`{column_name}`, '-', '')
                        WHERE `{column_name}` REGEXP '{UUID_REGEX}'
                    """)
                    total_updated += count
                    self.stdout.write(self.style.SUCCESS(f"  Normalized {table_name}.{column_name} ({count} rows)"))
            finally:
                cursor.execute("SET FOREIGN_KEY_CHECKS = 1;")

        self.stdout.write(self.style.SUCCESS(f"\nSuccessfully normalized {total_updated} UUID values across database!"))
