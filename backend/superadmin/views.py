from rest_framework import generics
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import get_user_model
from core.models import Daycare, SubscriptionPlan, DaycareSubscription
from core.serializers import AdminDaycareSerializer, AdminUserSerializer, SubscriptionPlanSerializer, DaycareSubscriptionSerializer
from core.permissions import IsSuperUser

User = get_user_model()

from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from django.utils import timezone
from core.models import AuditLog

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

class AdminDaycareListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    serializer_class = AdminDaycareSerializer
    pagination_class = StandardResultsSetPagination
    
    def get_queryset(self):
        queryset = Daycare.objects.all().order_by('-created_at')
        search = self.request.query_params.get('search', None)
        status_param = self.request.query_params.get('status', None)
        
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search)
            )
        if status_param:
            queryset = queryset.filter(status=status_param)
            
        return queryset

class AdminDaycareDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = Daycare.objects.all()
    serializer_class = AdminDaycareSerializer

    def perform_destroy(self, instance):
        instance.deleted_at = timezone.now()
        instance.deleted_by = self.request.user
        instance.status = 'Deleted'
        instance.save()
        
        AuditLog.objects.create(
            user=self.request.user, user_type='SuperAdmin',
            action='Delete Daycare', module='Daycares',
            entity_type='Daycare', entity_id=str(instance.id),
            new_values={'status': 'Deleted'}
        )

from django.db.models import Q

class AdminUserListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    serializer_class = AdminUserSerializer
    
    def get_queryset(self):
        return User.objects.filter(Q(is_staff=True) | Q(is_superuser=True)).order_by('-date_joined')
    
class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = User.objects.all()
    serializer_class = AdminUserSerializer

class AdminSubscriptionPlanListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionPlan.objects.all().order_by('monthly_price')
    serializer_class = SubscriptionPlanSerializer

class AdminSubscriptionPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionPlan.objects.all()
    serializer_class = SubscriptionPlanSerializer

class AdminDaycareSubscriptionListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = DaycareSubscription.objects.all().order_by('-created_at')
    serializer_class = DaycareSubscriptionSerializer

from django.db import transaction
from django.utils import timezone
from core.models import AuditLog
import uuid
import datetime
from dateutil.relativedelta import relativedelta

class AdminDaycareSubscriptionDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsSuperUser]
    queryset = DaycareSubscription.objects.all()
    serializer_class = DaycareSubscriptionSerializer

class AdminDaycareSubscriptionActionView(generics.GenericAPIView):
    permission_classes = [IsSuperUser]
    queryset = DaycareSubscription.objects.all()

    def post(self, request, pk, action):
        sub = self.get_object()
        
        if action == 'renew':
            # create payment & invoice
            invoice = SubscriptionInvoice.objects.create(
                invoice_number=f"MOCK-INV-{uuid.uuid4().hex[:8].upper()}",
                daycare=sub.daycare,
                subscription=sub,
                issue_date=timezone.now().date(),
                due_date=timezone.now().date() + datetime.timedelta(days=7),
                amount=sub.amount,
                total=sub.amount,
                status='paid',
                payment_date=timezone.now().date()
            )
            
            SubscriptionPayment.objects.create(
                daycare=sub.daycare,
                invoice=invoice,
                subscription=sub,
                amount=sub.amount,
                payment_date=timezone.now().date(),
                payment_method='Mock Credit Card',
                transaction_reference=f"MOCK-TXN-{uuid.uuid4().hex[:8].upper()}"
            )
            
            # update dates
            if sub.billing_cycle == 'Monthly':
                delta = relativedelta(months=1)
            elif sub.billing_cycle == 'Quarterly':
                delta = relativedelta(months=3)
            elif sub.billing_cycle == 'Annual':
                delta = relativedelta(years=1)
            else:
                delta = relativedelta(months=1)
                
            if not sub.expiry_date or sub.expiry_date < timezone.now().date():
                sub.expiry_date = timezone.now().date() + delta
            else:
                sub.expiry_date = sub.expiry_date + delta
                
            sub.renewal_date = sub.expiry_date
            sub.subscription_status = 'Active'
            sub.save()
            
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Subscription Renewed', module='Subscriptions',
                entity_type='DaycareSubscription', entity_id=str(sub.id),
                new_values={'expiry_date': str(sub.expiry_date)}
            )
            return Response({"status": "success", "message": "Subscription renewed", "expiry_date": sub.expiry_date})
            
        elif action == 'suspend':
            sub.subscription_status = 'suspended'
            sub.suspended_by = request.user
            sub.suspended_at = timezone.now()
            sub.suspension_reason = request.data.get('reason', 'Admin suspension')
            sub.save()
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Subscription Suspended', module='Subscriptions',
                entity_type='DaycareSubscription', entity_id=str(sub.id),
                new_values={'status': 'suspended'}
            )
            return Response({"status": "success", "message": "Subscription suspended"})
            
        elif action == 'cancel':
            sub.subscription_status = 'cancelled'
            sub.save()
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Subscription Cancelled', module='Subscriptions',
                entity_type='DaycareSubscription', entity_id=str(sub.id),
                new_values={'status': 'cancelled'}
            )
            return Response({"status": "success", "message": "Subscription cancelled"})
            
        return Response({"error": "Invalid action"}, status=400)

class DaycareActionView(generics.GenericAPIView):
    permission_classes = [IsSuperUser]
    queryset = Daycare.objects.all()

    def post(self, request, pk, action):
        daycare = self.get_object()
        
        if action == 'suspend':
            daycare.status = 'Suspended'
            reason = request.data.get('reason', '')
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Suspend Daycare', module='Daycares',
                entity_type='Daycare', entity_id=str(daycare.id),
                new_values={'status': 'Suspended', 'reason': reason}
            )
        elif action == 'activate':
            daycare.status = 'Active'
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Activate Daycare', module='Daycares',
                entity_type='Daycare', entity_id=str(daycare.id),
                new_values={'status': 'Active'}
            )
        elif action == 'restore':
            daycare.deleted_at = None
            daycare.deleted_by = None
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Restore Daycare', module='Daycares',
                entity_type='Daycare', entity_id=str(daycare.id),
                new_values={'deleted_at': None}
            )
        elif action == 'delete':
            daycare.deleted_at = timezone.now()
            daycare.deleted_by = request.user
            daycare.status = 'Deleted'
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Delete Daycare', module='Daycares',
                entity_type='Daycare', entity_id=str(daycare.id),
                new_values={'status': 'Deleted'}
            )
        else:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
            
        daycare.save()
        return Response({"status": "success", "daycare_status": daycare.status})

class DaycareOnboardingView(generics.GenericAPIView):
    permission_classes = [IsSuperUser]
    
    @transaction.atomic
    def post(self, request):
        data = request.data
        
        # 1. Create Daycare
        daycare_serializer = AdminDaycareSerializer(data=data.get('daycare'))
        daycare_serializer.is_valid(raise_exception=True)
        daycare = daycare_serializer.save()
        
        # 2. Create Admin
        admin_data = data.get('admin')
        if admin_data:
            admin_data['daycare'] = daycare.id
            admin_serializer = AdminUserSerializer(data=admin_data)
            admin_serializer.is_valid(raise_exception=True)
            admin = admin_serializer.save(is_staff=True, is_superuser=False)
        # 3. Create Subscription & Invoice
        subscription_data = data.get('subscription')
        if subscription_data:
            plan_id = subscription_data.get('plan_id')
            billing_cycle = subscription_data.get('billing_cycle', 'Monthly')
            if plan_id:
                try:
                    plan = SubscriptionPlan.objects.get(id=plan_id)
                    amount = getattr(plan, f"{billing_cycle.lower()}_price", plan.price)
                    
                    trial_days = plan.trial_days or 0
                    today = timezone.now().date()
                    
                    sub = DaycareSubscription.objects.create(
                        daycare=daycare,
                        subscription_plan=plan,
                        billing_cycle=billing_cycle,
                        amount=amount,
                        subscription_status='trial' if trial_days > 0 else 'active',
                        start_date=today if trial_days == 0 else today + datetime.timedelta(days=trial_days),
                        trial_start_date=today if trial_days > 0 else None,
                        trial_end_date=today + datetime.timedelta(days=trial_days) if trial_days > 0 else None
                    )
                    
                    if amount > 0:
                        from core.models import SubscriptionInvoice
                        import random
                        invoice_number = f"INV-{today.strftime('%Y%m%d')}-{random.randint(1000, 9999)}"
                        due_date = sub.start_date if sub.start_date else today
                        SubscriptionInvoice.objects.create(
                            daycare=daycare,
                            subscription=sub,
                            invoice_number=invoice_number,
                            issue_date=today,
                            due_date=due_date,
                            amount=amount,
                            tax=0,
                            total=amount,
                            status='unpaid'
                        )
                except SubscriptionPlan.DoesNotExist:
                    pass

        # 4. Audit Log
        AuditLog.objects.create(
            user=request.user, user_type='SuperAdmin',
            action='Onboard Daycare', module='Daycares',
            entity_type='Daycare', entity_id=str(daycare.id),
        )
        
        return Response({"status": "success", "daycare_id": daycare.id}, status=status.HTTP_201_CREATED)

class DaycareAdminListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    serializer_class = AdminUserSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return User.objects.filter(is_staff=True, daycare__isnull=False).order_by('-date_joined')
        
    def perform_create(self, serializer):
        if not self.request.data.get('daycare'):
            raise serializers.ValidationError({"daycare": "Daycare is required for a Daycare Admin."})
        serializer.save(is_staff=True, is_superuser=False)

class DaycareAdminDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsSuperUser]
    serializer_class = AdminUserSerializer
    
    def get_queryset(self):
        return User.objects.filter(is_staff=True, daycare__isnull=False)

class DaycareAdminActionView(generics.GenericAPIView):
    permission_classes = [IsSuperUser]
    
    def get_queryset(self):
        return User.objects.filter(is_staff=True, daycare__isnull=False)

    def post(self, request, pk, action):
        admin = self.get_object()
        
        if action == 'suspend':
            admin.status = 'Suspended'
            admin.is_active = False
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Suspend Daycare Admin', module='Users',
                entity_type='User', entity_id=str(admin.id),
                new_values={'status': 'Suspended'}
            )
        elif action == 'activate':
            admin.status = 'Active'
            admin.is_active = True
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Activate Daycare Admin', module='Users',
                entity_type='User', entity_id=str(admin.id),
                new_values={'status': 'Active'}
            )
        elif action == 'reset_password':
            new_password = request.data.get('password')
            if not new_password:
                return Response({"error": "Password is required"}, status=status.HTTP_400_BAD_REQUEST)
            admin.set_password(new_password)
            AuditLog.objects.create(
                user=request.user, user_type='SuperAdmin',
                action='Reset Admin Password', module='Users',
                entity_type='User', entity_id=str(admin.id)
            )
        else:
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
            
        admin.save()
        return Response({"status": "success", "admin_status": admin.status})

from core.models import AuditLog, SupportTicket, SupportTicketMessage, SubscriptionInvoice, SubscriptionPayment, User, Student, SubscriptionFeature, SystemAnnouncement
from core.serializers import (AuditLogSerializer, SupportTicketSerializer, SupportTicketMessageSerializer,
                             SubscriptionInvoiceSerializer, SubscriptionPaymentSerializer, SystemAnnouncementSerializer, SubscriptionFeatureSerializer)

class SubscriptionFeatureListView(generics.ListAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionFeature.objects.all().order_by('name')
    serializer_class = SubscriptionFeatureSerializer

class AuditLogListView(generics.ListAPIView):
    permission_classes = [IsSuperUser]
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        queryset = AuditLog.objects.all().order_by('-created_at')
        
        user_id = self.request.query_params.get('user', None)
        module = self.request.query_params.get('module', None)
        action = self.request.query_params.get('action', None)
        search = self.request.query_params.get('search', None)
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        
        if user_id:
            queryset = queryset.filter(user__id=user_id)
        if module:
            queryset = queryset.filter(module__iexact=module)
        if action:
            queryset = queryset.filter(action__iexact=action)
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        if search:
            queryset = queryset.filter(Q(action__icontains=search) | Q(module__icontains=search) | Q(entity_type__icontains=search))
            
        return queryset

class SupportTicketListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SupportTicket.objects.all().order_by('-created_at')
    serializer_class = SupportTicketSerializer

class SupportTicketDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = SupportTicket.objects.all()
    serializer_class = SupportTicketSerializer

    def perform_update(self, serializer):
        old_ticket = self.get_object()
        old_status = old_ticket.status
        old_priority = old_ticket.priority
        
        ticket = serializer.save()
        
        if old_status != ticket.status or old_priority != ticket.priority:
            AuditLog.objects.create(
                user=self.request.user,
                user_type='SuperAdmin',
                action='Updated Support Ticket',
                module='Support',
                entity_type='SupportTicket',
                entity_id=str(ticket.id),
                old_values={'status': old_status, 'priority': old_priority},
                new_values={'status': ticket.status, 'priority': ticket.priority},
                ip_address=self.request.META.get('REMOTE_ADDR')
            )

class SupportTicketMessageCreateView(generics.CreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SupportTicketMessage.objects.all()
    serializer_class = SupportTicketMessageSerializer

    def perform_create(self, serializer):
        ticket = SupportTicket.objects.get(pk=self.kwargs['pk'])
        serializer.save(ticket=ticket, sender=self.request.user)

class SystemAnnouncementListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SystemAnnouncement.objects.all().order_by('-created_at')
    serializer_class = SystemAnnouncementSerializer

    def perform_create(self, serializer):
        announcement = serializer.save(created_by=self.request.user)
        AuditLog.objects.create(
            user=self.request.user,
            user_type='SuperAdmin',
            action='Created Announcement',
            module='Announcements',
            entity_type='SystemAnnouncement',
            entity_id=str(announcement.id),
            new_values={'title': announcement.title, 'status': announcement.status},
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

class SystemAnnouncementDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsSuperUser]
    queryset = SystemAnnouncement.objects.all()
    serializer_class = SystemAnnouncementSerializer

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        announcement = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            user_type='SuperAdmin',
            action='Updated Announcement',
            module='Announcements',
            entity_type='SystemAnnouncement',
            entity_id=str(announcement.id),
            old_values={'status': old_status},
            new_values={'status': announcement.status},
            ip_address=self.request.META.get('REMOTE_ADDR')
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            user=self.request.user,
            user_type='SuperAdmin',
            action='Deleted Announcement',
            module='Announcements',
            entity_type='SystemAnnouncement',
            entity_id=str(instance.id),
            old_values={'title': instance.title},
            ip_address=self.request.META.get('REMOTE_ADDR')
        )
        instance.delete()

class SubscriptionInvoiceListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionInvoice.objects.all().order_by('-issue_date')
    serializer_class = SubscriptionInvoiceSerializer

class SubscriptionInvoiceDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionInvoice.objects.all()
    serializer_class = SubscriptionInvoiceSerializer

class SubscriptionPaymentListView(generics.ListCreateAPIView):
    permission_classes = [IsSuperUser]
    queryset = SubscriptionPayment.objects.all().order_by('-payment_date')
    serializer_class = SubscriptionPaymentSerializer

from django.db.models import Count, Sum, Q
from django.db.models.functions import TruncMonth
import datetime
from django.utils import timezone
from core.models import Daycare, DaycareSubscription, SubscriptionPlan, Student, Employee, Classroom, SubscriptionInvoice, SupportTicket

class SuperAdminDashboardView(generics.GenericAPIView):
    permission_classes = [IsSuperUser]
    
    def get(self, request):
        now = timezone.now()
        
        # Base Metrics
        total_daycares = Daycare.objects.count()
        active_daycares = Daycare.objects.filter(status__iexact='active').count()
        suspended_daycares = Daycare.objects.filter(status__iexact='suspended').count()
        
        # Trial daycares logic (based on subscription)
        trial_daycares = DaycareSubscription.objects.filter(
            Q(subscription_status__iexact='trial') |
            (Q(trial_start_date__isnull=False) & Q(trial_start_date__lte=now.date()) & Q(trial_end_date__gte=now.date()))
        ).count()
        
        active_subscriptions = DaycareSubscription.objects.filter(subscription_status__iexact='active').count()
        expired_subscriptions = DaycareSubscription.objects.filter(subscription_status__iexact='expired').count()
        
        total_students = Student.objects.count()
        total_staff = Employee.objects.count()
        total_classrooms = Classroom.objects.count()
        
        # Monthly Revenue (current month)
        current_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).date()
        revenue = SubscriptionInvoice.objects.filter(
            status__iexact='paid', 
            payment_date__gte=current_month
        ).aggregate(total=Sum('amount'))['total'] or 0.00
        
        pending_tickets = SupportTicket.objects.filter(status__iexact='open').count()
        
        # Chart Data: Daycare Growth (Last 6 months)
        six_months_ago = now - datetime.timedelta(days=180)
        daycare_growth = list(Daycare.objects.filter(created_at__gte=six_months_ago)
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month'))
            
        # Format dates for frontend
        for d in daycare_growth:
            d['month'] = d['month'].strftime('%b %Y') if d['month'] else ''

        # Chart Data: Subscription Status
        subscription_status = list(DaycareSubscription.objects.values('subscription_status')
            .annotate(count=Count('id')))
            
        # Chart Data: Revenue History (Last 6 months)
        revenue_history = list(SubscriptionInvoice.objects.filter(status__iexact='paid', payment_date__gte=six_months_ago.date())
            .annotate(month=TruncMonth('payment_date'))
            .values('month')
            .annotate(total=Sum('amount'))
            .order_by('month'))
            
        for r in revenue_history:
            r['month'] = r['month'].strftime('%b %Y') if r['month'] else ''

        return Response({
            "metrics": {
                "total_daycares": total_daycares,
                "active_daycares": active_daycares,
                "suspended_daycares": suspended_daycares,
                "trial_daycares": trial_daycares,
                "active_subscriptions": active_subscriptions,
                "expired_subscriptions": expired_subscriptions,
                "total_students": total_students,
                "total_staff": total_staff,
                "total_classrooms": total_classrooms,
                "monthly_revenue": float(revenue),
                "pending_tickets": pending_tickets
            },
            "charts": {
                "daycare_growth": daycare_growth,
                "subscription_status": subscription_status,
                "revenue_history": revenue_history
            }
        })


from core.models import RatioRule
from core.serializers import RatioRuleSerializer

class AdminSystemRatioRuleListView(generics.ListCreateAPIView):
    """
    Super Admin management for system-level baseline ratio rules.
    """
    permission_classes = [IsSuperUser]
    serializer_class = RatioRuleSerializer

    def get_queryset(self):
        qs = RatioRule.objects.filter(Q(daycare__isnull=True) | Q(is_system_rule=True)).select_related('province', 'program', 'age_group', 'created_by', 'updated_by')
        province_id = self.request.query_params.get('province_id')
        if province_id:
            qs = qs.filter(province_id=province_id)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(qualification_requirement__icontains=search))
        return qs.order_by('province__code', 'min_age_months')

    def perform_create(self, serializer):
        serializer.save(
            daycare=None,
            is_system_rule=True,
            created_by=self.request.user,
            updated_by=self.request.user
        )


class AdminSystemRatioRuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Super Admin detail, update, delete for system-level baseline ratio rules.
    """
    permission_classes = [IsSuperUser]
    serializer_class = RatioRuleSerializer
    queryset = RatioRule.objects.filter(Q(daycare__isnull=True) | Q(is_system_rule=True))

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)



