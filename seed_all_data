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
scripts_dir = os.path.join(APP_DIR, 'scripts')
if scripts_dir not in sys.path:
    sys.path.insert(0, scripts_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')

import django
django.setup()

if __name__ == '__main__':
    print("=" * 75)
    print("  KIDSYNQ - SEEDING ALL FEATURES & COMPLETE DEMO DATA")
    print("=" * 75)
    try:
        from scripts.seeds import seed_all_features
        seed_all_features.run()
    except Exception as e:
        print(f"Notice during seed_all_features: {e}")

    try:
        from scripts.seeds import seed_laim_miller_complete
        seed_laim_miller_complete.run()
    except Exception as e:
        print(f"Notice during seed_laim_miller_complete: {e}")

    print("=" * 75)
    print("  ALL DEMO & FEATURE DATA SEEDED SUCCESSFULLY!")
    print("=" * 75)
