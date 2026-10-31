"""
Reports and Analytics Domain Module.
Aggregates daily activity reports, compliance dashboard, ratio monitoring, and tasks.
"""
from daycare.views.daily_reports import *
from daycare.views.compliance import *
from daycare.views.ratio_monitoring import *
from . import tasks
