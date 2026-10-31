"""
Child and Student Domain Module.
Aggregates student records, health profiles, safe arrival tracking, and tasks.
"""
from daycare.views.students import *
from daycare.views.health import *
from daycare.views.safe_arrival import *
from . import tasks
