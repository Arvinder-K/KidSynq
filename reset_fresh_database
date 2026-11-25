#!/usr/bin/env python
import os
import sys

# Setup Python paths
APP_DIR = os.path.dirname(os.path.abspath(__file__))
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)
apps_dir = os.path.join(APP_DIR, 'apps')
if apps_dir not in sys.path:
    sys.path.insert(0, apps_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')

import django
django.setup()

from django.core.management import call_command

if __name__ == '__main__':
    print("=" * 75)
    print("  KIDSYNQ - EXECUTING FRESH DATABASE RESET FROM CPANEL / CLI")
    print("=" * 75)
    try:
        call_command('reset_fresh_database', no_input=True)
        print("=" * 75)
        print("  DATABASE RESET FINISHED SUCCESSFULLY!")
        print("=" * 75)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
