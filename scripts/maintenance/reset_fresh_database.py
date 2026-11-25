#!/usr/bin/env python
import os
import sys

# Setup Django environment
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
apps_dir = os.path.join(BASE_DIR, 'apps')
if apps_dir not in sys.path:
    sys.path.insert(0, apps_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')

import django
django.setup()

from django.core.management import call_command

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description="Reset KidSynq Database to a Fresh State (preserves SuperAdmin)")
    parser.add_argument('--no-input', action='store_true', help='Skip confirmation prompt')
    parser.add_argument('--admin-username', type=str, default='admin', help='SuperAdmin username to preserve')
    parser.add_argument('--admin-password', type=str, default=None, help='Password for SuperAdmin')
    parser.add_argument('--clear-plans', action='store_true', help='Also clear subscription plans')
    parser.add_argument('--clear-lookups', action='store_true', help='Also clear lookup tables')

    args = parser.parse_args()

    call_command(
        'reset_fresh_database',
        no_input=args.no_input,
        admin_username=args.admin_username,
        admin_password=args.admin_password,
        clear_plans=args.clear_plans,
        clear_lookups=args.clear_lookups,
    )

