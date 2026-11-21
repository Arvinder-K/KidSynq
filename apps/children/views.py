import uuid
from decimal import Decimal
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q, Sum, Count
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone
from django.views import View

from core.decorators import StaffRequiredMixin
from core.models import (
    Daycare, Student, StudentEmergencyContact, StudentPickup,
    StudentAttendance, Classroom, ClassroomStudent, Program, DailyReport,
    RegistrationApplication, WaitlistEntry,
    Family, FamilyChild, FamilyGuardian, Guardian,
    Invoice, InvoiceItem, Payment, ChildSubsidyProfile,
    IncidentReport, ConsentFormAssignment, FeeStructure
)

def get_user_daycare(user):
    if user.daycare:
        return user.daycare
    return Daycare.objects.first()

class ChildListView(StaffRequiredMixin, View):
    template_name = 'children/list.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        query = request.GET.get('q', '').strip()
        room_filter = request.GET.get('room', '').strip()
        status_filter = request.GET.get('status', 'active').strip()

        children = Student.objects.filter(daycare=daycare, deleted_at__isnull=True).prefetch_related('classroom_enrollments__classroom').order_by('last_name', 'first_name')

        if query:
            children = children.filter(
                Q(first_name__icontains=query) | Q(last_name__icontains=query) |
                Q(medical_notes__icontains=query) | Q(allergies__icontains=query)
            )
        if room_filter:
            children = children.filter(classroom_enrollments__classroom_id=room_filter, classroom_enrollments__status='Active')
        if status_filter and status_filter != 'all':
            children = children.filter(status__iexact=status_filter)

        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        paginator = Paginator(children, 20)
        page_obj = paginator.get_page(request.GET.get('page'))

        return render(request, self.template_name, {
            'page_obj': page_obj,
            'classrooms': classrooms,
            'q': query,
            'room': room_filter,
            'status': status_filter
        })

class ChildCreateView(StaffRequiredMixin, View):
    template_name = 'children/form.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).order_by('room_name')
        programs = Program.objects.filter(daycare=daycare).order_by('name')
        fee_structures = FeeStructure.objects.filter(daycare=daycare, is_active=True).order_by('name')
        return render(request, self.template_name, {
            'classrooms': classrooms,
            'programs': programs,
            'fee_structures': fee_structures,
        })

    def post(self, request):
        daycare = get_user_daycare(request.user)
        first_name = request.POST.get('first_name', '').strip()
        last_name = request.POST.get('last_name', '').strip()
        preferred_name = request.POST.get('preferred_name', '').strip()
        dob = request.POST.get('date_of_birth')
        gender = request.POST.get('gender', 'unspecified')
        classroom_id = request.POST.get('classroom_id')
        enrollment_date = request.POST.get('enrollment_date') or timezone.now().date()
        medical_info = request.POST.get('medical_info', '').strip()
        dietary_restrictions = request.POST.get('dietary_restrictions', '').strip()
        doctor_name = request.POST.get('doctor_name', '').strip()
        doctor_phone = request.POST.get('doctor_phone', '').strip()
        hospital_name = request.POST.get('hospital_name', '').strip()

        if not first_name or not last_name:
            messages.error(request, "First name and last name are required.")
            return redirect('daycare_child_new')

        # 1. Create Student
        student = Student.objects.create(
            daycare=daycare,
            first_name=first_name,
            last_name=last_name,
            preferred_name=preferred_name,
            dob=dob if dob else None,
            gender=gender,
            joining_date=enrollment_date,
            admission_date=enrollment_date,
            medical_notes=medical_info,
            dietary_restrictions=dietary_restrictions,
            doctor_name=doctor_name,
            doctor_phone=doctor_phone,
            hospital_name=hospital_name,
            status='Active'
        )

        # 2. Classroom Enrollment
        if classroom_id:
            ClassroomStudent.objects.create(
                student=student,
                classroom_id=classroom_id,
                status='Active',
                start_date=enrollment_date
            )

        # 3. Parent / Guardian Info
        guardian_first_name = request.POST.get('guardian_first_name', '').strip()
        guardian_last_name = request.POST.get('guardian_last_name', '').strip()
        guardian_relation = request.POST.get('guardian_relationship', 'Parent').strip()
        guardian_phone = request.POST.get('guardian_phone', '').strip()
        guardian_email = request.POST.get('guardian_email', '').strip()
        guardian_address = request.POST.get('guardian_address', '').strip()

        family_name = f"{guardian_last_name or last_name} Family"
        family, _ = Family.objects.get_or_create(
            daycare=daycare,
            family_name=family_name,
            defaults={
                'primary_phone': guardian_phone,
                'primary_email': guardian_email,
                'address': guardian_address,
                'status': 'Active'
            }
        )
        FamilyChild.objects.get_or_create(family=family, student=student)

        if guardian_first_name or guardian_phone or guardian_email:
            g_obj, _ = Guardian.objects.get_or_create(
                daycare=daycare,
                first_name=guardian_first_name or first_name,
                last_name=guardian_last_name or last_name,
                defaults={
                    'phone': guardian_phone,
                    'email': guardian_email or None,
                    'status': 'Active'
                }
            )
            FamilyGuardian.objects.get_or_create(
                family=family,
                guardian=g_obj,
                defaults={'relationship': guardian_relation, 'is_primary': True, 'status': 'Active'}
            )

        # 4. Attach Initial Invoice & Payment Option
        attach_invoice = request.POST.get('attach_invoice') in ['true', 'on', '1']
        invoice_obj = None
        payment_obj = None

        if attach_invoice:
            invoice_desc = request.POST.get('invoice_description', '').strip() or 'Monthly Childcare Tuition'
            raw_amount = request.POST.get('invoice_amount') or '1150.00'
            try:
                subtotal = Decimal(str(raw_amount))
            except Exception:
                subtotal = Decimal('1150.00')

            apply_cwelcc = request.POST.get('apply_cwelcc') in ['true', 'on', '1']
            if apply_cwelcc:
                discount = (subtotal * Decimal('0.5275')).quantize(Decimal('0.01'))
                total_amount = max(Decimal('0.00'), subtotal - discount)
                ChildSubsidyProfile.objects.create(
                    daycare=daycare,
                    student=student,
                    family=family,
                    program_name='CWELCC (Canada-Wide Early Learning & Child Care)',
                    subsidy_type='Fee Reduction',
                    subsidy_rate=Decimal('52.75'),
                    parent_co_pay_amount=total_amount,
                    is_active=True,
                    effective_from=enrollment_date
                )
            else:
                discount = Decimal('0.00')
                total_amount = subtotal

            payment_action = request.POST.get('payment_action', 'pay_now')
            due_date = request.POST.get('due_date') or (timezone.now().date() + timezone.timedelta(days=14))

            if payment_action == 'pay_now':
                paid_str = request.POST.get('paid_amount') or str(total_amount)
                try:
                    amount_paid = Decimal(str(paid_str))
                except Exception:
                    amount_paid = total_amount

                balance_due = max(Decimal('0.00'), total_amount - amount_paid)
                inv_status = 'PAID' if balance_due <= Decimal('0.00') else 'PARTIALLY_PAID'
                pay_method = request.POST.get('payment_method', 'ETRANSFER')
                txn_ref = request.POST.get('transaction_reference') or f"TXN-{uuid.uuid4().hex[:8].upper()}"
                payer_name = request.POST.get('payer_name') or f"{guardian_first_name} {guardian_last_name}".strip() or f"{family.family_name}"
                pay_date = request.POST.get('payment_date') or timezone.now().date()
            else:
                amount_paid = Decimal('0.00')
                balance_due = total_amount
                inv_status = 'ISSUED'

            invoice_num = f"INV-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:4].upper()}"
            invoice_obj = Invoice.objects.create(
                daycare=daycare,
                family=family,
                student=student,
                invoice_number=invoice_num,
                invoice_type='STANDARD',
                issue_date=timezone.now().date(),
                due_date=due_date,
                subtotal=subtotal,
                discount=discount,
                discount_total=discount,
                total_amount=total_amount,
                amount_paid=amount_paid,
                balance_due=balance_due,
                status=inv_status,
                currency='CAD',
                notes=invoice_desc
            )

            InvoiceItem.objects.create(
                invoice=invoice_obj,
                description=invoice_desc,
                quantity=1,
                unit_price=subtotal,
                subtotal=subtotal,
                total=subtotal
            )
            if apply_cwelcc and discount > 0:
                InvoiceItem.objects.create(
                    invoice=invoice_obj,
                    description='CWELCC 52.75% Provincial Fee Reduction',
                    quantity=1,
                    unit_price=-discount,
                    subtotal=-discount,
                    total=-discount
                )

            if payment_action == 'pay_now' and amount_paid > 0:
                receipt_num = f"REC-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:4].upper()}"
                payment_obj = Payment.objects.create(
                    daycare=daycare,
                    invoice=invoice_obj,
                    family=family,
                    student=student,
                    receipt_number=receipt_num,
                    amount=amount_paid,
                    currency='CAD',
                    payment_date=pay_date,
                    payment_method=pay_method,
                    status='COMPLETED',
                    transaction_reference=txn_ref,
                    payer_name=payer_name,
                    notes='Initial child enrollment fee receipt'
                )

        if invoice_obj and payment_obj:
            messages.success(request, f"Child '{first_name} {last_name}' enrolled successfully! Invoice '{invoice_obj.invoice_number}' created and Payment Receipt '{payment_obj.receipt_number}' generated.")
            return redirect(f"/daycare/children/{student.id}/?tab=billing")
        elif invoice_obj:
            messages.success(request, f"Child '{first_name} {last_name}' enrolled successfully with attached statement '{invoice_obj.invoice_number}'.")
            return redirect(f"/daycare/children/{student.id}/?tab=billing")
        else:
            messages.success(request, f"Child '{first_name} {last_name}' enrolled successfully.")
            return redirect('daycare_child_detail', pk=student.id)

class ChildDetailView(StaffRequiredMixin, View):
    template_name = 'children/detail.html'

    def get(self, request, pk):
        if request.user.is_superuser:
            child = get_object_or_404(Student, pk=pk)
            daycare = child.daycare
        else:
            daycare = get_user_daycare(request.user)
            child = get_object_or_404(Student, pk=pk, daycare=daycare)
        tab = request.GET.get('tab', 'overview')

        # 1. Classroom Allocation
        current_enrollment = ClassroomStudent.objects.filter(
            student=child, status='Active'
        ).select_related('classroom', 'classroom__primary_teacher', 'classroom__age_group').first()
        current_classroom = current_enrollment.classroom if current_enrollment else child.classroom
        enrollment_history = ClassroomStudent.objects.filter(
            student=child
        ).select_related('classroom', 'classroom__age_group').order_by('-start_date', '-created_at')
        classrooms = Classroom.objects.filter(daycare=daycare, deleted_at__isnull=True).select_related('age_group').order_by('room_name')

        # 2. Parent & Family Details
        family_links = FamilyChild.objects.filter(student=child).select_related('family')
        families = [fl.family for fl in family_links]
        family_guardians = FamilyGuardian.objects.filter(
            family__in=families
        ).select_related('guardian', 'family', 'guardian__user').order_by('-is_primary', 'created_at')
        primary_guardian = family_guardians.filter(is_primary=True).first() or family_guardians.first()

        # 3. Emergency Contacts & Authorized Pickups
        emergency_contacts = StudentEmergencyContact.objects.filter(student=child)
        pickups = StudentPickup.objects.filter(student=child)

        # 4. Invoices & Payment Receipts (Billing)
        invoices = Invoice.objects.filter(
            Q(student=child) | Q(family__in=families)
        ).select_related('family', 'student').prefetch_related('items').order_by('-issue_date', '-created_at')
        payments = Payment.objects.filter(
            Q(student=child) | Q(family__in=families)
        ).select_related('invoice', 'family', 'student').order_by('-payment_date', '-created_at')

        total_invoiced = invoices.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        total_paid = payments.filter(status__iexact='COMPLETED').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        balance_due = invoices.filter(status__in=['ISSUED', 'PARTIALLY_PAID', 'OVERDUE']).aggregate(total=Sum('balance_due'))['total'] or Decimal('0.00')
        subsidy = ChildSubsidyProfile.objects.filter(student=child, is_active=True).first()

        # 5. Daily Activity Reports
        all_reports = DailyReport.objects.filter(
            student=child
        ).select_related('teacher', 'classroom').prefetch_related('meals', 'naps', 'toileting').order_by('-report_date')
        today_report = all_reports.filter(report_date=timezone.now().date()).first()
        recent_reports = all_reports[:14]

        # 6. Incidents & Medical
        incident_reports = IncidentReport.objects.filter(
            student=child
        ).select_related('reporting_employee').order_by('-activity_date')

        # 7. Consent Forms
        consent_assignments = ConsentFormAssignment.objects.filter(
            student=child
        ).select_related('consent_form').order_by('-created_at')

        # 8. Attendance
        recent_attendance = StudentAttendance.objects.filter(
            student=child
        ).select_related('classroom').order_by('-attendance_date')[:30]
        total_days_attended = StudentAttendance.objects.filter(
            student=child,
            attendance_status__in=['PRESENT', 'present', 'CHECKED_IN', 'checked_in']
        ).count()

        return render(request, self.template_name, {
            'child': child,
            'active_tab': tab,
            # Classroom
            'current_enrollment': current_enrollment,
            'current_classroom': current_classroom,
            'enrollment_history': enrollment_history,
            'classrooms': classrooms,
            # Family & Guardians
            'families': families,
            'family_guardians': family_guardians,
            'primary_guardian': primary_guardian,
            # Emergency & Pickups
            'emergency_contacts': emergency_contacts,
            'pickups': pickups,
            # Billing
            'invoices': invoices,
            'payments': payments,
            'total_invoiced': total_invoiced,
            'total_paid': total_paid,
            'balance_due': balance_due,
            'subsidy': subsidy,
            # Reports & Medical
            'recent_reports': recent_reports,
            'today_report': today_report,
            'incident_reports': incident_reports,
            'consent_assignments': consent_assignments,
            # Attendance
            'recent_attendance': recent_attendance,
            'total_days_attended': total_days_attended,
        })

    def post(self, request, pk):
        if request.user.is_superuser:
            child = get_object_or_404(Student, pk=pk)
            daycare = child.daycare
        else:
            daycare = get_user_daycare(request.user)
            child = get_object_or_404(Student, pk=pk, daycare=daycare)
        action = request.POST.get('action')

        if action == 'update_personal':
            child.first_name = request.POST.get('first_name', child.first_name).strip()
            child.last_name = request.POST.get('last_name', child.last_name).strip()
            child.preferred_name = request.POST.get('preferred_name', child.preferred_name).strip()
            child.admission_number = request.POST.get('admission_number', child.admission_number).strip()
            dob = request.POST.get('date_of_birth')
            if dob:
                child.date_of_birth = dob
            child.gender = request.POST.get('gender', child.gender)
            child.language = request.POST.get('language', child.language).strip()
            # Medical
            child.allergies = request.POST.get('allergies', child.allergies).strip()
            child.medical_conditions = request.POST.get('medical_conditions', child.medical_conditions).strip()
            child.medication = request.POST.get('medication', child.medication).strip()
            child.dietary_restrictions = request.POST.get('dietary_restrictions', child.dietary_restrictions).strip()
            child.special_needs = request.POST.get('special_needs', child.special_needs).strip()
            child.doctor_name = request.POST.get('doctor_name', child.doctor_name).strip()
            child.doctor_phone = request.POST.get('doctor_phone', child.doctor_phone).strip()
            child.hospital_name = request.POST.get('hospital_name', child.hospital_name).strip()
            child.save()
            messages.success(request, "Child profile and medical information updated successfully.")

        elif action == 'change_classroom':
            room_id = request.POST.get('classroom_id')
            if room_id:
                new_room = get_object_or_404(Classroom, pk=room_id, daycare=daycare)
                # Transfer previous active enrollments
                ClassroomStudent.objects.filter(student=child, status='Active').exclude(classroom=new_room).update(
                    status='Transferred',
                    end_date=timezone.now().date()
                )
                enrollment, created = ClassroomStudent.objects.get_or_create(
                    student=child,
                    classroom=new_room,
                    defaults={'status': 'Active', 'start_date': timezone.now().date()}
                )
                if not created:
                    enrollment.status = 'Active'
                    enrollment.end_date = None
                    enrollment.save()
                messages.success(request, f"Assigned to classroom '{new_room.room_name}' successfully.")
            else:
                ClassroomStudent.objects.filter(student=child, status='Active').update(
                    status='Transferred',
                    end_date=timezone.now().date()
                )
                messages.success(request, "Classroom unassigned.")

        elif action == 'add_guardian':
            first_name = request.POST.get('first_name', '').strip()
            last_name = request.POST.get('last_name', '').strip()
            relationship = request.POST.get('relationship', 'Guardian').strip()
            phone = request.POST.get('phone', '').strip()
            email = request.POST.get('email', '').strip()
            is_primary = request.POST.get('is_primary') == 'on' or request.POST.get('is_primary') == 'true'

            if first_name and last_name:
                # Find or create child family
                fc = FamilyChild.objects.filter(student=child).first()
                if fc:
                    family = fc.family
                else:
                    family = Family.objects.create(
                        daycare=daycare,
                        family_name=f"{last_name} Family",
                        primary_phone=phone,
                        primary_email=email,
                        status='Active'
                    )
                    FamilyChild.objects.create(family=family, student=child)

                guardian = Guardian.objects.create(
                    daycare=daycare,
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                    phone=phone,
                    status='Active'
                )
                if is_primary:
                    FamilyGuardian.objects.filter(family=family).update(is_primary=False)
                FamilyGuardian.objects.create(
                    family=family,
                    guardian=guardian,
                    relationship=relationship,
                    is_primary=is_primary,
                    status='Active'
                )
                messages.success(request, f"Parent/Guardian '{first_name} {last_name}' added to {family.family_name}.")

        elif action == 'add_contact':
            name = request.POST.get('contact_name', '').strip()
            relation = request.POST.get('relation', '').strip()
            phone = request.POST.get('phone', '').strip()
            if name:
                StudentEmergencyContact.objects.create(
                    student=child,
                    name=name,
                    relationship=relation,
                    phone_number=phone
                )
                messages.success(request, f"Emergency contact '{name}' added.")

        elif action == 'add_pickup':
            name = request.POST.get('pickup_name', '').strip()
            relation = request.POST.get('relation', '').strip()
            phone = request.POST.get('phone', '').strip()
            if name:
                fc = FamilyChild.objects.filter(student=child).first()
                StudentPickup.objects.create(
                    daycare=daycare,
                    family=fc.family if fc else None,
                    student=child,
                    name=name,
                    relationship=relation,
                    phone=phone,
                    authorization_status='APPROVED'
                )
                messages.success(request, f"Authorized pickup person '{name}' added.")

        elif action == 'record_attendance':
            status_val = request.POST.get('attendance_status', 'PRESENT').upper()
            att_date = request.POST.get('attendance_date') or timezone.now().date()
            check_in = request.POST.get('check_in_time') or (timezone.now().strftime('%H:%M:%S') if status_val == 'PRESENT' else None)
            cur_room = child.classroom
            att, created = StudentAttendance.objects.get_or_create(
                student=child,
                attendance_date=att_date,
                defaults={
                    'daycare': daycare,
                    'classroom': cur_room,
                    'attendance_status': status_val,
                    'check_in_time': check_in,
                }
            )
            if not created:
                att.attendance_status = status_val
                if check_in:
                    att.check_in_time = check_in
                att.save()
            messages.success(request, f"Attendance for {att_date} recorded as {status_val}.")

        elif action == 'create_invoice':
            desc = request.POST.get('invoice_description', 'Monthly Childcare Tuition').strip() or 'Monthly Childcare Tuition'
            amount_val = request.POST.get('amount') or '1150.00'
            try:
                subtotal = Decimal(str(amount_val))
            except Exception:
                subtotal = Decimal('1150.00')

            apply_cwelcc = request.POST.get('apply_cwelcc') in ['true', 'on', '1']
            if apply_cwelcc:
                discount = (subtotal * Decimal('0.5275')).quantize(Decimal('0.01'))
                total_amount = max(Decimal('0.00'), subtotal - discount)
            else:
                discount = Decimal('0.00')
                total_amount = subtotal

            fc = FamilyChild.objects.filter(student=child).first()
            family = fc.family if fc else None
            due_date = request.POST.get('due_date') or (timezone.now().date() + timezone.timedelta(days=14))
            inv_num = f"INV-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:4].upper()}"

            inv = Invoice.objects.create(
                daycare=daycare,
                family=family,
                student=child,
                invoice_number=inv_num,
                invoice_type='STANDARD',
                issue_date=timezone.now().date(),
                due_date=due_date,
                subtotal=subtotal,
                discount=discount,
                discount_total=discount,
                total_amount=total_amount,
                amount_paid=Decimal('0.00'),
                balance_due=total_amount,
                status='ISSUED',
                currency='CAD',
                notes=desc
            )
            InvoiceItem.objects.create(
                invoice=inv,
                description=desc,
                quantity=1,
                unit_price=subtotal,
                subtotal=subtotal,
                total=subtotal
            )
            if apply_cwelcc and discount > 0:
                InvoiceItem.objects.create(
                    invoice=inv,
                    description='CWELCC 52.75% Provincial Fee Reduction',
                    quantity=1,
                    unit_price=-discount,
                    subtotal=-discount,
                    total=-discount
                )
            messages.success(request, f"Invoice '{inv.invoice_number}' created and attached to {child.first_name} successfully.")
            return redirect(f"{request.path}?tab=billing")

        elif action == 'record_payment':
            inv_id = request.POST.get('invoice_id')
            inv = get_object_or_404(Invoice, pk=inv_id, daycare=daycare)
            amount_val = request.POST.get('amount') or str(inv.balance_due)
            try:
                pay_amount = Decimal(str(amount_val))
            except Exception:
                pay_amount = inv.balance_due

            pay_method = request.POST.get('payment_method', 'ETRANSFER')
            txn_ref = request.POST.get('transaction_reference') or f"TXN-{uuid.uuid4().hex[:8].upper()}"
            payer_name = request.POST.get('payer_name') or (inv.family.family_name if inv.family else f"{child.first_name}'s Parent")
            pay_date = request.POST.get('payment_date') or timezone.now().date()

            receipt_num = f"REC-{timezone.now().strftime('%Y%m')}-{uuid.uuid4().hex[:4].upper()}"
            Payment.objects.create(
                daycare=daycare,
                invoice=inv,
                family=inv.family,
                student=child,
                receipt_number=receipt_num,
                amount=pay_amount,
                currency='CAD',
                payment_date=pay_date,
                payment_method=pay_method,
                status='COMPLETED',
                transaction_reference=txn_ref,
                payer_name=payer_name,
                notes=request.POST.get('notes', 'Tuition payment recorded')
            )

            inv.amount_paid = inv.amount_paid + pay_amount
            inv.balance_due = max(Decimal('0.00'), inv.total_amount - inv.amount_paid)
            if inv.balance_due <= Decimal('0.00'):
                inv.status = 'PAID'
            else:
                inv.status = 'PARTIALLY_PAID'
            inv.save()

            messages.success(request, f"Payment of ${pay_amount:.2f} recorded! Receipt '{receipt_num}' generated.")
            return redirect(f"{request.path}?tab=billing")

        return redirect(f"{request.path}?tab={request.POST.get('tab', 'overview')}")

class AdmissionsListView(StaffRequiredMixin, View):
    template_name = 'children/admissions.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        applications = RegistrationApplication.objects.filter(daycare=daycare).order_by('-submitted_at')
        return render(request, self.template_name, {'applications': applications})

class WaitlistListView(StaffRequiredMixin, View):
    template_name = 'children/waitlist.html'

    def get(self, request):
        daycare = get_user_daycare(request.user)
        waitlist = WaitlistEntry.objects.filter(daycare=daycare).order_by('priority', '-created_at')
        return render(request, self.template_name, {'waitlist': waitlist})

