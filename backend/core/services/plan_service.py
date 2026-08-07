from core.models import SubscriptionPlan

class PlanService:
    @staticmethod
    def create_plan(data: dict) -> SubscriptionPlan:
        return SubscriptionPlan.objects.create(**data)

    @staticmethod
    def update_plan(plan: SubscriptionPlan, data: dict) -> SubscriptionPlan:
        for key, value in data.items():
            setattr(plan, key, value)
        plan.save()
        return plan

    @staticmethod
    def delete_plan(plan: SubscriptionPlan) -> bool:
        plan.delete()
        return True
