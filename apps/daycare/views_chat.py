"""
KidSynq Operations AI Chat Assistant View.
Replicates the CheckOnIt dark ambient glassmorphic interface and provides real-time
operational intelligence across children, attendance, classrooms, staff, emergency contacts,
and tuition billing.
"""
import json
import uuid
from decimal import Decimal
from datetime import date, timedelta
from django.db.models import Q, Sum
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views import View

from apps.core.decorators import StaffRequiredMixin
from core.models import (
    Daycare, Student, StudentAttendance, Classroom, ClassroomStudent,
    Employee, StaffAttendance, Invoice, Payment, StudentEmergencyContact,
    StudentPickup, DailyReport, IncidentReport, Family, FamilyChild
)


class ChatAssistantView(StaffRequiredMixin, View):
    """
    Renders the CheckOnIt ambient glassmorphism chat UI and handles
    context-aware operational queries about children, educators, classrooms,
    attendance, and tuition.
    """

    def get_daycare(self, request):
        if hasattr(request.user, 'daycare') and request.user.daycare:
            return request.user.daycare
        # Fallback for SuperAdmin without an assigned daycare
        return Daycare.objects.first()

    def get(self, request):
        daycare = self.get_daycare(request)
        if not daycare:
            return render(request, 'errors/404.html', {'message': 'No active daycare found.'})

        # Suggest active children for the quick chips on the gate view
        suggested_students = Student.objects.filter(
            daycare=daycare, status='Active'
        ).order_by('first_name')[:8]

        # Top educators for reference
        educators = Employee.objects.filter(
            daycare=daycare
        ).filter(Q(status='Active') | Q(status__isnull=True)).order_by('first_name')[:4]

        # Check for preselected student query params
        preselected_name = ""
        preselected_email = ""
        student_id = request.GET.get('student_id')
        if student_id:
            try:
                val_uuid = uuid.UUID(student_id)
                st = Student.objects.filter(id=val_uuid, daycare=daycare).first()
                if st:
                    preselected_name = f"{st.first_name} {st.last_name}".strip()
            except (ValueError, TypeError):
                pass
        elif request.GET.get('q'):
            preselected_name = request.GET.get('q').strip()

        context = {
            'daycare': daycare,
            'suggested_students': suggested_students,
            'educators': educators,
            'preselected_name': preselected_name,
            'preselected_email': preselected_email,
            'staff_name': request.user.get_full_name() or request.user.username or "Staff",
            'staff_email': request.user.email or "staff@kidsynq.com",
            'is_dev': False,
        }
        return render(request, 'daycare/chat.html', context)

    def post(self, request):
        """
        Handles incoming query from the composer.
        Accepts application/json body: { message, entity, conversationId }
        """
        try:
            data = json.loads(request.body.decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return JsonResponse({'error': 'Invalid JSON request payload.'}, status=400)

        message = data.get('message', '').strip()
        entity = data.get('entity', '').strip()
        conversation_id = data.get('conversationId') or str(uuid.uuid4())

        if not message:
            return JsonResponse({'error': 'Message content cannot be empty.'}, status=400)

        daycare = self.get_daycare(request)
        if not daycare:
            return JsonResponse({'error': 'No daycare context available.'}, status=400)

        # Resolve entity and build answer
        answer = self.resolve_query(daycare, entity, message)

        return JsonResponse({
            'status': 'success',
            'conversationId': conversation_id,
            'messageId': f"msg-{uuid.uuid4().hex[:10]}",
            'answer': answer,
        })

    def resolve_query(self, daycare, entity, message):
        """
        Parses intent and searches database for live accurate daycare operational answers.
        """
        message_lower = message.lower()
        today = timezone.localdate()

        # 1. Search for matching Student
        student = None
        if entity:
            student = self.find_student(daycare, entity)

        # 2. If no student yet, check if message itself mentions a student name
        if not student:
            for s in Student.objects.filter(daycare=daycare)[:50]:
                full_name = f"{s.first_name} {s.last_name}".lower()
                if s.first_name.lower() in message_lower or full_name in message_lower:
                    student = s
                    break

        # 3. Check if target is an Employee/Educator
        employee = None
        if not student and entity:
            employee = self.find_employee(daycare, entity)

        # ----------------------------------------------------
        # SCENARIO A: Target is a STUDENT
        # ----------------------------------------------------
        if student:
            full_name = f"{student.first_name} {student.last_name}".strip()
            room_name = getattr(student.classroom, 'room_name', getattr(student.classroom, 'name', 'Unassigned Room'))

            # A1: Attendance Intent
            if any(k in message_lower for k in ['attend', 'check-in', 'clock-in', 'present', 'absent', 'roll', 'arrival']):
                att_today = StudentAttendance.objects.filter(student=student, attendance_date=today).first()
                recent_att = StudentAttendance.objects.filter(student=student).order_by('-attendance_date')[:5]

                if att_today:
                    st_val = att_today.attendance_status or "Logged"
                    status_str = f"Status today ({today.strftime('%b %d, %Y')}): **{st_val.upper()}**"
                    times = []
                    if att_today.check_in_time:
                        times.append(f"Checked in at **{att_today.check_in_time.strftime('%I:%M %p')}**")
                    if att_today.check_out_time:
                        times.append(f"Checked out at **{att_today.check_out_time.strftime('%I:%M %p')}**")
                    time_details = f" ({', '.join(times)})" if times else ""
                    res = f"📋 **Attendance for {full_name}**\n\n• {status_str}{time_details}\n• Assigned Classroom: **{room_name}**\n"
                else:
                    res = f"📋 **Attendance for {full_name}**\n\n• Today ({today.strftime('%b %d, %Y')}): **No attendance punch logged yet**.\n• Assigned Classroom: **{room_name}**\n"

                if recent_att.exists():
                    res += "\n**Recent Attendance History:**\n"
                    for a in recent_att:
                        punch = ""
                        if a.check_in_time:
                            punch = f" ({a.check_in_time.strftime('%I:%M %p')})"
                        att_st = a.attendance_status.capitalize() if a.attendance_status else "Recorded"
                        res += f"• {a.attendance_date.strftime('%a %b %d')}: {att_st}{punch}\n"
                return res

            # A2: Emergency Contacts & Pickups Intent
            if any(k in message_lower for k in ['emergency', 'contact', 'pickup', 'pick up', 'guardian', 'parent', 'authorized']):
                contacts = student.emergency_contacts.all()
                pickups = student.pickups.all()
                families = FamilyChild.objects.filter(student=student).select_related('family')

                res = f"🛡️ **Guardians, Emergency Contacts & Pickups for {full_name}**\n\n"

                # Parents / Guardians
                if families.exists():
                    res += "**Registered Family:**\n"
                    for fc in families:
                        fam = fc.family
                        res += f"• Family: **{fam.family_name}**\n"
                        if fam.primary_phone:
                            res += f"  - Phone: {fam.primary_phone}\n"
                        if fam.primary_email:
                            res += f"  - Email: {fam.primary_email}\n"

                # Emergency Contacts
                if contacts.exists():
                    res += "\n**Emergency Contacts:**\n"
                    for c in contacts:
                        rel = f" ({c.relationship})" if c.relationship else ""
                        phone = f" - {c.mobile}" if c.mobile else ""
                        primary = " [Primary]" if getattr(c, 'is_primary', False) else ""
                        res += f"• **{c.name}**{rel}{primary}{phone}\n"
                else:
                    res += "\n• No separate emergency contacts recorded.\n"

                # Authorized Pickups
                if pickups.exists():
                    res += "\n**Authorized Pickups:**\n"
                    for p in pickups:
                        rel = f" ({p.relationship})" if p.relationship else ""
                        phone = f" - {p.phone}" if p.phone else ""
                        auth_status = getattr(p, 'authorization_status', 'Approved')
                        allowed = " ✅ Approved" if auth_status == 'Approved' else f" ⚠️ {auth_status}"
                        res += f"• **{p.name}**{rel}{allowed}{phone}\n"

                return res

            # A3: Classroom & Ratio Intent
            if any(k in message_lower for k in ['room', 'classroom', 'ratio', 'teacher', 'educator', 'capacity']):
                cls = student.classroom
                if not cls:
                    return f"🏫 **Classroom Details for {full_name}**\n\n• Currently not assigned to an active classroom.\n• Status: **{student.status}**"

                enrollments_count = ClassroomStudent.objects.filter(classroom=cls).filter(Q(status='Active') | Q(status__isnull=True)).count()
                teacher_name = cls.primary_teacher.get_full_name() if cls.primary_teacher else "Assigned ECE Staff"
                ratio_target = getattr(cls.ratio_rule, 'target_ratio', '1:8') if hasattr(cls, 'ratio_rule') and cls.ratio_rule else "1:8"
                cls_title = getattr(cls, 'room_name', getattr(cls, 'name', 'Classroom'))

                res = f"🏫 **Classroom Information: {cls_title}**\n\n"
                res += f"• Student: **{full_name}**\n"
                res += f"• Age Group: **{getattr(cls, 'age_group', 'Standard')}**\n"
                res += f"• Room Capacity: **{getattr(cls, 'capacity', 'N/A')}** students\n"
                res += f"• Currently Enrolled: **{enrollments_count}** students\n"
                res += f"• Statutory Ratio: **{ratio_target}**\n"
                res += f"• Lead Educator: **{teacher_name}**\n"
                return res

            # A4: Tuition, Invoices & Payments Intent
            if any(k in message_lower for k in ['fee', 'tuition', 'invoice', 'payment', 'balance', 'owe', 'cost', 'bill']):
                invoices = student.invoices.all().order_by('-issue_date')[:6]
                total_invoiced = student.invoices.aggregate(s=Sum('total_amount'))['s'] or Decimal('0.00')
                total_paid = student.invoices.aggregate(s=Sum('amount_paid'))['s'] or Decimal('0.00')
                balance = total_invoiced - total_paid

                res = f"💳 **Billing & Tuition Summary for {full_name}**\n\n"
                res += f"• Total Invoiced to Date: **${total_invoiced:,.2f}**\n"
                res += f"• Total Payments Recorded: **${total_paid:,.2f}**\n"
                res += f"• Current Outstanding Balance: **${balance:,.2f}**\n"

                if invoices.exists():
                    res += "\n**Recent Invoices:**\n"
                    for inv in invoices:
                        inv_num = inv.invoice_number or str(inv.id)[:8]
                        res += f"• Inv #{inv_num} - **${inv.total_amount:,.2f}** ({inv.status}) due {inv.due_date.strftime('%b %d, %Y') if inv.due_date else 'N/A'}\n"
                else:
                    res += "\n• No invoices generated for this student yet."
                return res

            # A5: Allergies, Health, Medication & Dietary Intent
            if any(k in message_lower for k in ['allergy', 'allergies', 'health', 'medical', 'diet', 'food', 'medicine', 'doctor']):
                res = f"🩺 **Health, Allergy & Medical Profile for {full_name}**\n\n"
                has_health_info = False

                if student.allergies:
                    res += f"⚠️ **Allergies:** {student.allergies}\n"
                    has_health_info = True
                else:
                    res += "• Allergies: None recorded\n"

                if student.dietary_restrictions:
                    res += f"🥗 **Dietary Restrictions:** {student.dietary_restrictions}\n"
                    has_health_info = True

                if student.medical_conditions:
                    res += f"⚕️ **Medical Conditions:** {student.medical_conditions}\n"
                    has_health_info = True

                if student.medication:
                    res += f"💊 **Medication Plan:** {student.medication}\n"
                    has_health_info = True

                if student.doctor_name:
                    phone = f" ({student.doctor_phone})" if student.doctor_phone else ""
                    hosp = f" · {student.hospital_name}" if student.hospital_name else ""
                    res += f"👨‍⚕️ **Primary Physician:** Dr. {student.doctor_name}{phone}{hosp}\n"

                if not has_health_info:
                    res += "\n✅ This child has no active critical medical or dietary restrictions on file."
                return res

            # A6: Daily Reports / Incidents Intent
            if any(k in message_lower for k in ['daily', 'report', 'activity', 'nap', 'meal', 'incident', 'mood']):
                d_reports = DailyReport.objects.filter(student=student).order_by('-report_date')[:3]
                incidents = IncidentReport.objects.filter(student=student).order_by('-activity_date')[:2]

                res = f"📝 **Daily Logs & Activities for {full_name}**\n\n"
                if d_reports.exists():
                    for rep in d_reports:
                        res += f"• **Report for {rep.report_date.strftime('%a %b %d, %Y')}**\n"
                        if rep.notes:
                            res += f"  - Notes: {rep.notes}\n"
                else:
                    res += "• No daily report recorded for today yet.\n"

                if incidents.exists():
                    res += "\n⚠️ **Incident Reports On File:**\n"
                    for inc in incidents:
                        inc_type = inc.incident_type or 'Incident'
                        res += f"• {inc.activity_date.strftime('%b %d, %Y')}: {inc_type} (Severity: {inc.severity or 'Standard'})\n"
                return res

            # A7: Overview / Default for Student
            dob_str = student.dob.strftime('%b %d, %Y') if student.dob else 'Not recorded'
            att_today = StudentAttendance.objects.filter(student=student, attendance_date=today).first()
            att_status = att_today.attendance_status.upper() if (att_today and att_today.attendance_status) else "Not Checked-In"

            res = f"🌟 **Operational Overview: {full_name}**\n\n"
            res += f"• **Status:** {student.status}\n"
            res += f"• **Classroom:** {room_name}\n"
            res += f"• **Date of Birth:** {dob_str}\n"
            res += f"• **Today's Attendance:** {att_status}\n"
            if student.allergies:
                res += f"• **Allergy Alert:** ⚠️ {student.allergies}\n"
            else:
                res += "• **Allergies:** None recorded (Clear)\n"

            contacts = student.emergency_contacts.all()[:2]
            if contacts.exists():
                contact_strs = [f"{c.name} ({c.mobile})" for c in contacts if c.mobile]
                if contact_strs:
                    res += f"• **Primary Contacts:** {', '.join(contact_strs)}\n"

            res += f"\n💡 *You can ask me about {student.first_name}'s attendance history, billing & tuition, allergies, emergency contacts, or daily activities.*"
            return res

        # ----------------------------------------------------
        # SCENARIO B: Target is an EDUCATOR / EMPLOYEE
        # ----------------------------------------------------
        if employee:
            emp_name = f"{employee.first_name} {employee.last_name}".strip()
            att_today = StaffAttendance.objects.filter(employee=employee, date=today).first()

            punch_info = "Not clocked in today"
            if att_today:
                in_time = att_today.clock_in.strftime('%I:%M %p') if att_today.clock_in else "—"
                out_time = att_today.clock_out.strftime('%I:%M %p') if att_today.clock_out else "Active Shift"
                punch_info = f"{att_today.status.capitalize()} (In: {in_time} · Out: {out_time})"

            res = f"👩‍🏫 **Educator Profile: {emp_name}**\n\n"
            res += f"• **Position:** {employee.role} / {employee.job_title or 'Staff'}\n"
            res += f"• **Today's Punch Status:** {punch_info}\n"
            res += f"• **Email:** {employee.email}\n"
            if employee.phone:
                res += f"• **Phone:** {employee.phone}\n"
            return res

        # ----------------------------------------------------
        # SCENARIO C: Center-wide / General Operations Query
        # ----------------------------------------------------
        if any(k in message_lower for k in ['center', 'how many', 'total', 'attendance today', 'summary', 'overview', 'daycare', 'who is here']):
            total_students = Student.objects.filter(daycare=daycare, status='Active').count()
            present_today = StudentAttendance.objects.filter(
                student__daycare=daycare, attendance_date=today, attendance_status='Present'
            ).count()
            rooms_count = Classroom.objects.filter(daycare=daycare, status='Active').count()
            staff_clocked_in = StaffAttendance.objects.filter(
                employee__daycare=daycare, date=today, status='clocked_in'
            ).count()

            res = f"🏢 **{daycare.name} · Live Daily Operations Summary**\n\n"
            res += f"• **Total Active Enrolled Children:** {total_students}\n"
            res += f"• **Children Present Today:** {present_today} of {total_students}\n"
            res += f"• **Active Classrooms:** {rooms_count}\n"
            res += f"• **Staff Currently On Duty:** {staff_clocked_in} educators clocked in\n\n"
            res += "💡 *To check a specific child or educator, type their name above or ask anything about their schedule, ratios, or tuition.*"
            return res

        # Fallback / Helpful guidance
        if entity:
            return (
                f"I couldn't locate a child or staff record matching '**{entity}**' in {daycare.name}.\n\n"
                "Please verify the name or email, or select one of the suggested children from the gate screen to begin."
            )
        else:
            return (
                "👋 Hello! I am your **KidSynq Operations Copilot**.\n\n"
                "I can assist you with real-time center intelligence:\n"
                "• **Student Attendance & Check-in Punches**\n"
                "• **Authorized Emergency Contacts & Pickups**\n"
                "• **Classroom Ratios & Educator Shift Schedules**\n"
                "• **Family Billing, Invoices & Tuition Balances**\n"
                "• **Allergy, Medical & Dietary Alerts**\n\n"
                "Please enter a child's name, parent email, or question above to get started!"
            )

    def find_student(self, daycare, query_str):
        q = query_str.strip()
        if not q:
            return None

        # Check if valid UUID first
        try:
            val_uuid = uuid.UUID(q)
            s = Student.objects.filter(id=val_uuid, daycare=daycare).first()
            if s:
                return s
        except (ValueError, TypeError, AttributeError):
            pass

        # Try name tokens
        parts = q.split()
        if len(parts) >= 2:
            s = Student.objects.filter(
                daycare=daycare,
                first_name__iexact=parts[0],
                last_name__iexact=parts[1]
            ).first()
            if s:
                return s

        s = Student.objects.filter(
            daycare=daycare
        ).filter(
            Q(first_name__icontains=q) |
            Q(last_name__icontains=q) |
            Q(admission_number__iexact=q)
        ).first()
        if s:
            return s

        # Try parent email
        fc = FamilyChild.objects.filter(
            student__daycare=daycare,
            family__primary_email__iexact=q
        ).select_related('student').first()
        if fc:
            return fc.student

        return None

    def find_employee(self, daycare, query_str):
        q = query_str.strip()
        if not q:
            return None
        parts = q.split()
        if len(parts) >= 2:
            e = Employee.objects.filter(
                daycare=daycare,
                first_name__iexact=parts[0],
                last_name__iexact=parts[1]
            ).first()
            if e:
                return e

        return Employee.objects.filter(
            daycare=daycare
        ).filter(
            Q(first_name__icontains=q) |
            Q(last_name__icontains=q) |
            Q(email__iexact=q)
        ).first()
