import json
import uuid
from decimal import Decimal
from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.core.paginator import Paginator
from django.db.models import Sum, Count, Q
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.views import View

from core.decorators import SuperAdminRequiredMixin
from core.models import (
    Daycare, User, SubscriptionPlan, DaycareSubscription,
    SubscriptionInvoice, SubscriptionPayment, AuditLog,
    SupportTicket, SupportTicketMessage, SystemAnnouncement,
    RatioRule, Student, Employee, Classroom
)


def create_subscription_invoice(subscription=None, daycare=None, status='paid', issue_date=None, due_date=None, amount=None):
    """
    Utility helper to reliably generate a SubscriptionInvoice and optional completed SubscriptionPayment.
    """
    if subscription and not daycare:
        daycare = subscription.daycare
    if not daycare and subscription:
        daycare = subscription.daycare

    now_dt = timezone.now()
    issue_date = issue_date or now_dt.date()
    due_date = due_date or issue_date

    if amount is None:
        if subscription:
            plan = subscription.subscription_plan
            amount = Decimal(str(subscription.amount or (plan.monthly_price if plan else 0.00)))
        else:
            amount = Decimal('0.00')
    else:
        amount = Decimal(str(amount))

    invoice = SubscriptionInvoice.objects.create(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        daycare=daycare,
        subscription=subscription,
        issue_date=issue_date,
        due_date=due_date,
        amount=amount,
        tax=Decimal('0.00'),
        total=amount,
        status=status.lower(),
        payment_date=issue_date if status.lower() == 'paid' else None,
        created_at=now_dt,
        updated_at=now_dt,
    )

    if status.lower() == 'paid':
        SubscriptionPayment.objects.create(
            amount=amount,
            payment_date=issue_date,
            currency='CAD',
            payment_method='Credit Card (System)',
            payment_status='completed',
            transaction_reference=f"TXN-{uuid.uuid4().hex[:10].upper()}",
            created_at=now_dt,
            updated_at=now_dt,
            daycare=daycare,
            invoice=invoice,
            subscription=subscription,
        )

    return invoice


class SuperAdminLoginView(View):
    template_name = 'superadmin/login.html'

    def get(self, request):
        if request.user.is_authenticated and (request.user.is_superuser or getattr(request.user, 'role', '') in ['SuperAdmin', 'Admin', 'admin']):
            return redirect('superadmin_dashboard')
        return render(request, self.template_name, {
            'next': request.GET.get('next', '')
        })

    def post(self, request):
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        next_url = request.POST.get('next', '')

        if not username or not password:
            messages.error(request, "Please enter both administrator username and password.")
            return render(request, self.template_name, {'username': username, 'next': next_url})

        user = authenticate(request, username=username, password=password)

        if user is not None:
            if not user.is_active:
                messages.error(request, "This administrator account is inactive.")
                return render(request, self.template_name, {'username': username, 'next': next_url})

            if not (user.is_superuser or user.is_staff):
                messages.error(request, "Access restricted. Only platform Super Administrators may sign in here.")
                return render(request, self.template_name, {'username': username, 'next': next_url})

            login(request, user)
            messages.success(request, f"Welcome back, {user.first_name or user.username}!")

            if next_url and url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
                return redirect(next_url)
            return redirect('superadmin_dashboard')
        else:
            messages.error(request, "Invalid administrator credentials.")
            return render(request, self.template_name, {'username': username, 'next': next_url})


class SuperAdminLogoutView(View):
    def get(self, request):
        logout(request)
        messages.info(request, "You have been signed out from the Super Admin portal.")
        return redirect('superadmin_login')

    def post(self, request):
        logout(request)
        messages.info(request, "You have been signed out from the Super Admin portal.")
        return redirect('superadmin_login')

class SuperAdminDashboardView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/dashboard.html'

    def get(self, request):
        today = timezone.now().date()
        
        # 1. Summary Metrics
        total_daycares = Daycare.objects.count()
        active_daycares = Daycare.objects.filter(status='active').count()
        total_students = Student.objects.filter(status='active').count()
        total_employees = Employee.objects.filter(status='active').count()

        # Subscriptions & Revenue
        active_subs = DaycareSubscription.objects.filter(subscription_status='active').count()
        monthly_revenue = SubscriptionPayment.objects.filter(
            payment_date__year=today.year, payment_date__month=today.month
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        open_tickets = SupportTicket.objects.filter(status__in=['open', 'in_progress']).count()

        # 2. Recent Entities
        recent_daycares = Daycare.objects.order_by('-created_at')[:6]
        recent_invoices = SubscriptionInvoice.objects.select_related('subscription__daycare').order_by('-issue_date')[:6]
        recent_logs = AuditLog.objects.order_by('-created_at')[:6]

        # 3. Chart Data (Plans distribution)
        plan_counts = list(DaycareSubscription.objects.values('subscription_plan__name').annotate(count=Count('id')))
        chart_plan_labels = [p['subscription_plan__name'] or 'Standard' for p in plan_counts]
        chart_plan_data = [p['count'] for p in plan_counts]

        context = {
            'total_daycares': total_daycares,
            'active_daycares': active_daycares,
            'total_students': total_students,
            'total_employees': total_employees,
            'active_subs': active_subs,
            'monthly_revenue': monthly_revenue,
            'open_tickets': open_tickets,
            'recent_daycares': recent_daycares,
            'recent_invoices': recent_invoices,
            'recent_logs': recent_logs,
            'chart_plan_labels': json.dumps(chart_plan_labels),
            'chart_plan_data': json.dumps(chart_plan_data),
        }
        return render(request, self.template_name, context)


class DaycareListView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/daycares/list.html'

    def get(self, request):
        query = request.GET.get('q', '').strip()
        status_filter = request.GET.get('status', '').strip()

        daycares = Daycare.objects.all().order_by('-created_at')

        if query:
            daycares = daycares.filter(
                Q(name__icontains=query) | Q(city__icontains=query) | Q(email__icontains=query)
            )
        if status_filter:
            daycares = daycares.filter(status=status_filter)

        paginator = Paginator(daycares, 15)
        page_number = request.GET.get('page')
        page_obj = paginator.get_page(page_number)

        return render(request, self.template_name, {
            'page_obj': page_obj,
            'q': query,
            'status': status_filter
        })


class DaycareCreateView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/daycares/create.html'

    def get(self, request):
        plans = SubscriptionPlan.objects.filter(status='Active').order_by('monthly_price')
        return render(request, self.template_name, {'plans': plans})

    def post(self, request):
        name = request.POST.get('name', '').strip()
        email = request.POST.get('email', '').strip()
        phone = request.POST.get('phone', '').strip()
        address = request.POST.get('address', '').strip()
        city = request.POST.get('city', '').strip()
        state = request.POST.get('state', '').strip()
        zip_code = request.POST.get('zip_code', '').strip()
        plan_id = request.POST.get('plan_id')

        admin_username = request.POST.get('admin_username', '').strip()
        admin_email = request.POST.get('admin_email', '').strip() or email
        admin_password = request.POST.get('admin_password', '').strip()
        admin_first_name = request.POST.get('admin_first_name', '').strip()
        admin_last_name = request.POST.get('admin_last_name', '').strip()

        if not name or not admin_username or not admin_password:
            messages.error(request, "Daycare name, admin username, and password are required.")
            plans = SubscriptionPlan.objects.filter(status='Active').order_by('monthly_price')
            return render(request, self.template_name, {'plans': plans})

        if User.objects.filter(username=admin_username).exists():
            messages.error(request, f"Username '{admin_username}' already exists. Choose a different username.")
            plans = SubscriptionPlan.objects.filter(status='Active').order_by('monthly_price')
            return render(request, self.template_name, {'plans': plans})

        # 1. Create Daycare
        daycare = Daycare.objects.create(
            name=name,
            email=email,
            phone=phone,
            address1=address,
            city=city,
            state=state,
            postal_code=zip_code,
            status='Active'
        )

        # 2. Create Admin User
        admin_user = User.objects.create_user(
            username=admin_username,
            email=admin_email,
            password=admin_password,
            first_name=admin_first_name,
            last_name=admin_last_name,
            is_staff=True,
            daycare=daycare,
            is_active=True
        )

        # 3. Assign Subscription Plan & Generate Initial Invoice
        if plan_id:
            plan = SubscriptionPlan.objects.filter(id=plan_id).first()
            if plan:
                sub = DaycareSubscription.objects.create(
                    daycare=daycare,
                    subscription_plan=plan,
                    subscription_status='Active',
                    billing_cycle='monthly',
                    amount=plan.monthly_price,
                    start_date=timezone.now().date(),
                )
                create_subscription_invoice(sub, status='paid')

        messages.success(request, f"Daycare '{name}' and administrator '{admin_username}' created successfully!")
        return redirect('superadmin_daycares')


class DaycareDetailView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/daycares/detail.html'

    def get(self, request, pk):
        daycare = get_object_or_404(Daycare, pk=pk)
        subscription = DaycareSubscription.objects.filter(daycare=daycare).select_related('subscription_plan').first()

        # Auto-heal: If daycare has an active subscription but no invoice exists yet, generate initial invoice
        if subscription and not SubscriptionInvoice.objects.filter(daycare=daycare).exists():
            create_subscription_invoice(subscription, status='paid')

        invoices = SubscriptionInvoice.objects.filter(daycare=daycare).select_related('subscription__subscription_plan').order_by('-issue_date', '-created_at')
        admins = User.objects.filter(daycare=daycare).exclude(guardian_profile__isnull=False)
        student_count = Student.objects.filter(daycare=daycare).count()
        employee_count = Employee.objects.filter(daycare=daycare).count()
        classroom_count = Classroom.objects.filter(daycare=daycare).count()
        plans = SubscriptionPlan.objects.filter(status='Active')

        return render(request, self.template_name, {
            'daycare': daycare,
            'subscription': subscription,
            'admins': admins,
            'student_count': student_count,
            'employee_count': employee_count,
            'classroom_count': classroom_count,
            'plans': plans,
            'invoices': invoices,
        })

    def post(self, request, pk):
        daycare = get_object_or_404(Daycare, pk=pk)
        action = request.POST.get('action')

        if action == 'toggle_status':
            new_status = request.POST.get('status')
            if new_status in ['active', 'suspended', 'inactive']:
                daycare.status = new_status
                daycare.save()
                messages.success(request, f"Status updated to '{new_status}'.")
        elif action == 'assign_plan':
            plan_id = request.POST.get('plan_id')
            plan = get_object_or_404(SubscriptionPlan, pk=plan_id)
            sub = DaycareSubscription.objects.filter(daycare=daycare).first()
            if sub:
                sub.subscription_plan = plan
                sub.amount = plan.monthly_price
                sub.save()
            else:
                sub = DaycareSubscription.objects.create(
                    daycare=daycare,
                    subscription_plan=plan,
                    subscription_status='Active',
                    billing_cycle='monthly',
                    amount=plan.monthly_price,
                    start_date=timezone.now().date(),
                )
            create_subscription_invoice(sub, status='paid')
            messages.success(request, f"Assigned '{plan.name}' plan and generated invoice successfully.")
        elif action == 'generate_invoice':
            sub = DaycareSubscription.objects.filter(daycare=daycare).first()
            amount_val = request.POST.get('amount')
            status_val = request.POST.get('status', 'paid')
            issue_date = request.POST.get('issue_date') or None
            due_date = request.POST.get('due_date') or None
            amount = Decimal(amount_val) if amount_val else (sub.amount if sub else Decimal('0.00'))
            inv = create_subscription_invoice(
                subscription=sub,
                daycare=daycare,
                status=status_val,
                issue_date=issue_date,
                due_date=due_date,
                amount=amount
            )
            messages.success(request, f"Invoice '{inv.invoice_number}' created successfully.")
        elif action == 'mark_invoice_paid':
            invoice_id = request.POST.get('invoice_id')
            inv = get_object_or_404(SubscriptionInvoice, pk=invoice_id, daycare=daycare)
            inv.status = 'paid'
            inv.payment_date = timezone.now().date()
            inv.save()
            if not SubscriptionPayment.objects.filter(invoice=inv).exists():
                SubscriptionPayment.objects.create(
                    amount=inv.amount,
                    payment_date=inv.payment_date,
                    currency='CAD',
                    payment_method='Credit Card (System)',
                    payment_status='completed',
                    transaction_reference=f"TXN-{uuid.uuid4().hex[:10].upper()}",
                    created_at=timezone.now(),
                    updated_at=timezone.now(),
                    daycare=daycare,
                    invoice=inv,
                    subscription=inv.subscription
                )
            messages.success(request, f"Invoice '{inv.invoice_number}' marked as Paid.")
        elif action == 'reset_admin_password':
            user_id = request.POST.get('user_id')
            new_password = request.POST.get('new_password', '').strip()
            if not new_password:
                messages.error(request, "New password cannot be empty.")
            elif len(new_password) < 6:
                messages.error(request, "Password must be at least 6 characters.")
            else:
                admin_user = get_object_or_404(User, pk=user_id, daycare=daycare)
                admin_user.set_password(new_password)
                admin_user.save()
                messages.success(request, f"Password for administrator '{admin_user.username}' was reset successfully.")

        return redirect('superadmin_daycare_detail', pk=pk)


class DaycareAdminListView(SuperAdminRequiredMixin, View):
    """
    Daycare administrators are managed directly within their respective Daycare Center
    under /superadmin/daycares/<id>/. This view redirects to /superadmin/daycares/ to avoid duplicate management.
    """
    def get(self, request):
        return redirect('superadmin_daycares')


class AdminUserListView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/users/list.html'

    def get(self, request):
        query = request.GET.get('q', '').strip()
        role_filter = request.GET.get('role', '').strip()

        users = User.objects.select_related('daycare').order_by('-date_joined')

        if query:
            users = users.filter(
                Q(username__icontains=query) | Q(email__icontains=query) |
                Q(first_name__icontains=query) | Q(last_name__icontains=query)
            )
        if role_filter:
            rf = role_filter.lower()
            if rf in ['superadmin', 'platform admin', 'superuser']:
                users = users.filter(is_superuser=True)
            elif rf in ['daycareadmin', 'daycare admin', 'admin']:
                users = users.filter(daycare__isnull=False).exclude(guardian_profile__isnull=False)
            elif rf in ['guardian', 'parent']:
                users = users.filter(guardian_profile__isnull=False)
            elif rf in ['staff', 'teacher', 'educator', 'employee']:
                users = users.filter(employee_profile__isnull=False)

        paginator = Paginator(users, 20)
        page_obj = paginator.get_page(request.GET.get('page'))

        return render(request, self.template_name, {
            'page_obj': page_obj,
            'q': query,
            'role': role_filter
        })


class PlanListView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/plans/list.html'

    def get(self, request):
        plans = SubscriptionPlan.objects.all().order_by('monthly_price')
        return render(request, self.template_name, {'plans': plans})


class PlanCreateEditView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/plans/form.html'

    def get(self, request, pk=None):
        plan = get_object_or_404(SubscriptionPlan, pk=pk) if pk else None
        return render(request, self.template_name, {'plan': plan})

    def post(self, request, pk=None):
        plan = get_object_or_404(SubscriptionPlan, pk=pk) if pk else None

        name = request.POST.get('name', '').strip()
        price = request.POST.get('price', '0').strip()
        billing_frequency = request.POST.get('billing_frequency', 'monthly')
        max_students = request.POST.get('max_students', '50')
        max_staff = request.POST.get('max_staff', '10')
        max_classrooms = request.POST.get('max_classrooms', '5')
        max_storage_gb = request.POST.get('max_storage_gb', '5')
        is_active = request.POST.get('is_active') == 'on'

        try:
            price_dec = Decimal(price or '0')
        except Exception:
            price_dec = Decimal('0.00')

        def to_float(v, default=0.0):
            try:
                return float(str(v).strip())
            except (ValueError, TypeError):
                return default

        def to_int(v, default=0):
            try:
                return int(round(float(str(v).strip())))
            except (ValueError, TypeError):
                return default

        students_val = to_int(max_students, 50)
        staff_val = to_int(max_staff, 10)
        classrooms_val = to_int(max_classrooms, 5)
        storage_gb_float = to_float(max_storage_gb, 5.0)
        storage_mb = int(round(storage_gb_float * 1024))
        status_val = 'Active' if is_active else 'Inactive'

        if plan:
            plan.name = name
            plan.monthly_price = price_dec
            plan.max_students = students_val
            plan.max_staff = staff_val
            plan.max_classrooms = classrooms_val
            plan.max_storage_mb = storage_mb
            plan.status = status_val
            plan.save()
            messages.success(request, f"Plan '{name}' updated successfully.")
        else:
            SubscriptionPlan.objects.create(
                name=name,
                monthly_price=price_dec,
                max_students=students_val,
                max_staff=staff_val,
                max_classrooms=classrooms_val,
                max_storage_mb=storage_mb,
                status=status_val
            )
            messages.success(request, f"Plan '{name}' created successfully.")

        return redirect('superadmin_plans')


class SubscriptionListView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/subscriptions/list.html'

    def get(self, request):
        subs = DaycareSubscription.objects.select_related('daycare', 'subscription_plan').order_by('-start_date')
        paginator = Paginator(subs, 20)
        page_obj = paginator.get_page(request.GET.get('page'))
        return render(request, self.template_name, {'page_obj': page_obj})


class PlatformInvoiceListView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/invoices/list.html'

    def get(self, request):
        invoices = SubscriptionInvoice.objects.select_related('daycare', 'subscription__subscription_plan').order_by('-issue_date', '-created_at')
        paginator = Paginator(invoices, 20)
        page_obj = paginator.get_page(request.GET.get('page'))
        return render(request, self.template_name, {'page_obj': page_obj})


class PlatformPaymentListView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/payments/list.html'

    def get(self, request):
        payments = SubscriptionPayment.objects.select_related('daycare', 'invoice', 'subscription__subscription_plan').order_by('-payment_date', '-created_at')
        paginator = Paginator(payments, 20)
        page_obj = paginator.get_page(request.GET.get('page'))
        return render(request, self.template_name, {'page_obj': page_obj})


class PlatformAnalyticsView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/analytics/overview.html'

    def get(self, request):
        today = timezone.now().date()
        total_revenue = SubscriptionPayment.objects.aggregate(total=Sum('amount'))['total'] or 0
        monthly_revenue = SubscriptionPayment.objects.filter(
            payment_date__year=today.year, payment_date__month=today.month
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Status breakdowns
        sub_status_counts = list(DaycareSubscription.objects.values('subscription_status').annotate(count=Count('id')))
        status_dict = {item['subscription_status'].lower(): item['count'] for item in sub_status_counts}

        chart_status_labels = ['Active', 'Trial', 'Cancelled', 'Suspended']
        chart_status_data = [
            status_dict.get('active', 0),
            status_dict.get('trial', 0),
            status_dict.get('cancelled', 0),
            status_dict.get('suspended', 0)
        ]

        return render(request, self.template_name, {
            'total_revenue': total_revenue,
            'monthly_revenue': monthly_revenue,
            'chart_status_labels': json.dumps(chart_status_labels),
            'chart_status_data': json.dumps(chart_status_data),
        })


class SystemRatioRulesView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/ratio_rules/list.html'

    def get(self, request):
        rules = RatioRule.objects.filter(is_system_rule=True).order_by('province', 'name')
        return render(request, self.template_name, {'rules': rules})


class PlatformAuditLogView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/audit/list.html'

    def get(self, request):
        query = request.GET.get('q', '').strip()
        logs = AuditLog.objects.select_related('user').order_by('-created_at')

        if query:
            logs = logs.filter(
                Q(action__icontains=query) | Q(module__icontains=query) |
                Q(entity_type__icontains=query) | Q(ip_address__icontains=query)
            )

        paginator = Paginator(logs, 25)
        page_obj = paginator.get_page(request.GET.get('page'))
        return render(request, self.template_name, {'page_obj': page_obj, 'q': query})


class SystemAnnouncementView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/announcements/list.html'

    def get(self, request):
        announcements = SystemAnnouncement.objects.order_by('-created_at')
        return render(request, self.template_name, {'announcements': announcements})

    def post(self, request):
        title = request.POST.get('title', '').strip()
        message = request.POST.get('message', '').strip()
        priority = request.POST.get('priority', 'info')

        if title and message:
            SystemAnnouncement.objects.create(
                title=title,
                content=message,
                status='published',
                publish_date=timezone.now(),
                created_at=timezone.now(),
                updated_at=timezone.now(),
                created_by=request.user
            )
            messages.success(request, "System announcement broadcasted successfully.")
        return redirect('superadmin_announcements')


class SupportTicketListView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/tickets/list.html'

    def get(self, request):
        tickets = SupportTicket.objects.select_related('daycare', 'created_by').order_by('-created_at')
        paginator = Paginator(tickets, 20)
        page_obj = paginator.get_page(request.GET.get('page'))
        return render(request, self.template_name, {'page_obj': page_obj})


class SupportTicketDetailView(SuperAdminRequiredMixin, View):
    template_name = 'superadmin/tickets/detail.html'

    def get(self, request, pk):
        ticket = get_object_or_404(SupportTicket, pk=pk)
        chat_messages = SupportTicketMessage.objects.filter(ticket=ticket).order_by('created_at')
        return render(request, self.template_name, {
            'ticket': ticket,
            'chat_messages': chat_messages
        })

    def post(self, request, pk):
        ticket = get_object_or_404(SupportTicket, pk=pk)
        reply = request.POST.get('message', '').strip()
        new_status = request.POST.get('status')

        if reply:
            SupportTicketMessage.objects.create(
                ticket=ticket,
                sender=request.user,
                message=reply
            )
            messages.success(request, "Reply submitted.")

        if new_status and new_status in ['open', 'in_progress', 'resolved', 'closed']:
            ticket.status = new_status
            ticket.save()
            messages.info(request, f"Ticket marked as {new_status}.")

        return redirect('superadmin_ticket_detail', pk=pk)

