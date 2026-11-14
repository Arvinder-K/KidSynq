from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.models import (
    Daycare, DaycareSubscription, SubscriptionInvoice, SubscriptionPayment, 
    Student, Employee, Classroom, Document, SubscriptionPlan
)
from django.db.models import Sum, Count, Q
from django.utils import timezone
import datetime

class SaaSAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        
        # 1. Revenue Analytics
        total_revenue = SubscriptionPayment.objects.aggregate(total=Sum('amount'))['total'] or 0
        
        # Monthly Revenue (Current Month)
        current_month_revenue = SubscriptionPayment.objects.filter(
            payment_date__year=today.year, 
            payment_date__month=today.month
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        # Outstanding Payments (Unpaid Invoices)
        outstanding = SubscriptionInvoice.objects.filter(
            status__iexact='unpaid'
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Revenue by Plan (for charts)
        revenue_by_plan = list(SubscriptionPayment.objects.values(
            'invoice__subscription__subscription_plan__name'
        ).annotate(total=Sum('amount')).order_by('-total'))
        
        revenue_chart_data = {
            'labels': [item['invoice__subscription__subscription_plan__name'] or 'Unknown' for item in revenue_by_plan],
            'data': [float(item['total']) for item in revenue_by_plan]
        }

        # 2. Subscription Analytics
        sub_status_counts = list(DaycareSubscription.objects.values('subscription_status').annotate(count=Count('id')))
        status_dict = {item['subscription_status'].lower(): item['count'] for item in sub_status_counts}
        
        total_subs = sum(status_dict.values())
        active_subs = status_dict.get('active', 0)
        trial_subs = status_dict.get('trial', 0)
        cancelled_subs = status_dict.get('cancelled', 0)
        
        sub_chart_data = {
            'labels': ['Active', 'Trial', 'Cancelled', 'Expired', 'Suspended'],
            'data': [
                status_dict.get('active', 0),
                status_dict.get('trial', 0),
                status_dict.get('cancelled', 0),
                status_dict.get('expired', 0),
                status_dict.get('suspended', 0)
            ]
        }

        # 3. Usage Analytics (Totals)
        total_daycares = Daycare.objects.count()
        total_students = Student.objects.count()
        total_staff = Employee.objects.count()
        total_classrooms = Classroom.objects.count()
        total_storage = Document.objects.aggregate(total=Sum('file_size'))['total'] or 0
        
        # 4. Daycare Usage Table
        daycares = Daycare.objects.all()
        daycare_usage = []
        
        for d in daycares:
            active_sub = d.subscriptions.filter(subscription_status__in=['active', 'trial']).first()
            plan_name = "None"
            max_students, max_staff, max_classrooms, max_storage_mb = 0, 0, 0, 0
            
            if active_sub:
                plan = active_sub.subscription_plan
                plan_name = plan.name
                max_students = plan.max_students
                max_staff = plan.max_staff
                max_classrooms = plan.max_classrooms
                max_storage_mb = plan.max_storage_mb
                
            student_count = Student.objects.filter(daycare=d).count()
            staff_count = Employee.objects.filter(daycare=d).count()
            classroom_count = Classroom.objects.filter(daycare=d).count()
            storage_bytes = Document.objects.filter(daycare=d).aggregate(total=Sum('file_size'))['total'] or 0
            storage_mb = round(storage_bytes / (1024 * 1024), 2)
            
            # Calculate Usage %
            # We take the highest usage metric as the overall usage %
            percentages = []
            if max_students > 0: percentages.append((student_count / max_students) * 100)
            if max_staff > 0: percentages.append((staff_count / max_staff) * 100)
            if max_classrooms > 0: percentages.append((classroom_count / max_classrooms) * 100)
            if max_storage_mb > 0: percentages.append((storage_mb / max_storage_mb) * 100)
            
            overall_usage_pct = max(percentages) if percentages else 0
            
            daycare_usage.append({
                'id': str(d.id),
                'name': d.name,
                'plan': plan_name,
                'students': student_count,
                'max_students': max_students,
                'staff': staff_count,
                'max_staff': max_staff,
                'classrooms': classroom_count,
                'max_classrooms': max_classrooms,
                'storage_mb': storage_mb,
                'max_storage_mb': max_storage_mb,
                'usage_pct': round(overall_usage_pct, 1)
            })

        return Response({
            'revenue': {
                'total': total_revenue,
                'monthly': current_month_revenue,
                'outstanding': outstanding,
                'chart': revenue_chart_data
            },
            'subscriptions': {
                'total': total_subs,
                'active': active_subs,
                'trial': trial_subs,
                'cancelled': cancelled_subs,
                'chart': sub_chart_data
            },
            'usage': {
                'total_daycares': total_daycares,
                'total_students': total_students,
                'total_staff': total_staff,
                'total_classrooms': total_classrooms,
                'total_storage_mb': round(total_storage / (1024 * 1024), 2),
                'daycares': daycare_usage
            }
        })
