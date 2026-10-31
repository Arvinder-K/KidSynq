"""
Parent and Family Domain Services.
Business logic for family linking, guardian invitations, and authorized pickups.
"""
from core.models import Family, Guardian

class ParentService:
    @staticmethod
    def get_family_guardians(family_id):
        return Guardian.objects.filter(family_guardians__family_id=family_id)

    @staticmethod
    def get_guardians_by_daycare(daycare):
        return Guardian.objects.filter(family_guardians__family__daycare=daycare).distinct()
