"""
Backward-compatibility proxy for clean_daycare_data.
Actual implementation is in daycare.classroom.tasks.clean_daycare_data.
"""
from daycare.classroom.tasks.clean_daycare_data import clean_all_daycare_data

__all__ = ['clean_all_daycare_data']

