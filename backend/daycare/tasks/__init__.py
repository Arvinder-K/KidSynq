"""
Daycare operational tasks, workflows, and verifications.
Tasks are housed within their respective domain folders:
- daycare.child.tasks
- daycare.staff.tasks
- daycare.parent.tasks
- daycare.reports.tasks
- daycare.billing.tasks
- daycare.classroom.tasks
- daycare.schedule.tasks
"""
from daycare.child import tasks as child
from daycare.staff import tasks as staff
from daycare.parent import tasks as parent
from daycare.reports import tasks as reports
from daycare.billing import tasks as billing
from daycare.classroom import tasks as classroom
from daycare.schedule import tasks as schedule
from daycare.classroom.tasks.clean_daycare_data import clean_all_daycare_data

__all__ = [
    'child',
    'staff',
    'parent',
    'reports',
    'billing',
    'classroom',
    'schedule',
    'clean_all_daycare_data',
]
