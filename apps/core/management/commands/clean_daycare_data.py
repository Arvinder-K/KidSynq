import sys
import os
from django.core.management.base import BaseCommand

# Ensure scripts directory is available for import
scripts_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../scripts/maintenance'))
if scripts_dir not in sys.path:
    sys.path.insert(0, scripts_dir)

try:
    from clean_daycare_data import clean_all_daycare_data
except ImportError:
    from scripts.maintenance.clean_daycare_data import clean_all_daycare_data

class Command(BaseCommand):
    help = 'Clean all operational/test daycare data (students, families, attendance, invoices, etc.)'

    def add_arguments(self, parser):
        parser.add_argument('--daycare', type=str, help='Filter by daycare name')
        parser.add_argument('--include-classrooms', action='store_true', help='Also delete classrooms, programs and age groups')
        parser.add_argument('--include-employees', action='store_true', help='Also delete employees')
        parser.add_argument('--include-daycares', action='store_true', help='Also delete daycare records')

    def handle(self, *args, **options):
        clean_all_daycare_data(
            target_daycare_name=options.get('daycare'),
            delete_classrooms=options.get('include_classrooms', False),
            delete_employees=options.get('include_employees', False),
            delete_daycares=options.get('include_daycares', False)
        )
