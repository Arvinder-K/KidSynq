import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.db import transaction
from core.models import (
    Daycare, Branch, Classroom, Student, Program, AgeGroup, User, Employee,
    Family, Guardian, FamilyGuardian, FamilyChild, ClassroomStudent,
    ClassroomTeacherAssignment, StudentAttendance, StudentEmergencyContact,
    StudentPickup, HealthProfile, DailyReport, DailyReportActivity, SafeArrivalDepartureEvent,
    AuthorizedPickupPerson, ChildEnrollment, ChildVaccinationRecord, ChildDocument,
    ConsentForm, ConsentFormAssignment, ConsentSignature, GuardianInvitation,
    StaffSchedule, StaffShiftSwap, StaffShortageAlert, StaffAttendanceRecord,
    EmployeeLeaveRequest, EmployeeTimesheet, EmployeeTimesheetEntry,
    EmployeeQualification, EmployeeCertification, EmployeeEmergencyContact,
    RatioComplianceHistory, RatioAuditLog, RatioManualOverride,
    WaitlistEntry, RegistrationApplication, ApplicationDocument,
    FeeStructure, ChildFeeAssignment, RegistrationFeeRecord, DepositRecord,
    DiscountRule, SiblingDiscountRule, CreditTransaction, LateFeeRule,
    Invoice, InvoiceItem, Payment, PaymentRefund, RecurringBillingProfile,
    ChildSubsidyProfile, TaxReceipt, FamilyAccountStatement, AuditLog
)

def clean_all_daycare_data(target_daycare_name=None, delete_classrooms=False, delete_employees=False, delete_daycares=False):
    """
    Cleans operational data (students, families, attendance, daily reports, invoices, payments, etc.)
    while safely preserving core system users and structure.
    """
    print("=" * 70)
    print(" 🧹 KIDSYNQ - DAYCARE DATA CLEANUP SCRIPT")
    print("=" * 70)

    if target_daycare_name:
        daycares = Daycare.objects.filter(name__icontains=target_daycare_name)
        if not daycares.exists():
            print(f"❌ No daycare found matching name: '{target_daycare_name}'")
            return
    else:
        daycares = Daycare.objects.all()

    print(f"🎯 Target Daycares to clean: {daycares.count()}")
    for d in daycares:
        print(f"   - {d.name} (ID: {d.id})")

    with transaction.atomic():
        total_counts = {}

        for daycare in daycares:
            print(f"\n--- Cleaning data for Daycare: {daycare.name} ---")

            # 1. Billing, Payments & Invoices
            def count_and_delete(queryset, label):
                c = queryset.count()
                if c > 0:
                    queryset.delete()
                    total_counts[label] = total_counts.get(label, 0) + c
                    print(f"   ✓ Deleted {c} {label}")

            # Subsidies & Tax Receipts
            count_and_delete(TaxReceipt.objects.filter(daycare=daycare), "Tax Receipts")
            count_and_delete(ChildSubsidyProfile.objects.filter(daycare=daycare), "Subsidy Profiles")
            count_and_delete(RecurringBillingProfile.objects.filter(daycare=daycare), "Recurring Billing Profiles")
            count_and_delete(FamilyAccountStatement.objects.filter(daycare=daycare), "Account Statements")

            # Payments & Refunds
            count_and_delete(PaymentRefund.objects.filter(payment__daycare=daycare), "Payment Refunds")
            count_and_delete(Payment.objects.filter(daycare=daycare), "Payments")
            
            # Invoices & Items
            count_and_delete(InvoiceItem.objects.filter(invoice__daycare=daycare), "Invoice Items")
            count_and_delete(Invoice.objects.filter(daycare=daycare), "Invoices")

            # Fee structures, discounts, deposits, credits
            count_and_delete(CreditTransaction.objects.filter(daycare=daycare), "Credit Transactions")
            count_and_delete(LateFeeRule.objects.filter(daycare=daycare), "Late Fee Rules")
            count_and_delete(SiblingDiscountRule.objects.filter(daycare=daycare), "Sibling Discount Rules")
            count_and_delete(DiscountRule.objects.filter(daycare=daycare), "Discount Rules")
            count_and_delete(DepositRecord.objects.filter(daycare=daycare), "Deposit Records")
            count_and_delete(RegistrationFeeRecord.objects.filter(daycare=daycare), "Registration Fee Records")
            count_and_delete(ChildFeeAssignment.objects.filter(daycare=daycare), "Child Fee Assignments")
            count_and_delete(FeeStructure.objects.filter(daycare=daycare), "Fee Structures")

            # 2. Daily Child Reports & Activities
            count_and_delete(DailyReportActivity.objects.filter(daily_report__daycare=daycare), "Daily Report Activities")
            count_and_delete(DailyReport.objects.filter(daycare=daycare), "Daily Reports")

            # 3. Attendance, Pickups & Safe Arrivals
            count_and_delete(StudentAttendance.objects.filter(daycare=daycare), "Student Attendance Records")
            count_and_delete(SafeArrivalDepartureEvent.objects.filter(daycare=daycare), "Safe Arrival/Departure Events")
            count_and_delete(AuthorizedPickupPerson.objects.filter(daycare=daycare), "Authorized Pickups")
            count_and_delete(StudentPickup.objects.filter(daycare=daycare), "Student Pickups")

            # 4. Student Health, Documents & Enrollments
            count_and_delete(StudentEmergencyContact.objects.filter(student__daycare=daycare), "Student Emergency Contacts")
            count_and_delete(HealthProfile.objects.filter(daycare=daycare), "Health Profiles")
            count_and_delete(ChildVaccinationRecord.objects.filter(student__daycare=daycare), "Vaccination Records")
            count_and_delete(ChildDocument.objects.filter(student__daycare=daycare), "Child Documents")
            count_and_delete(ChildEnrollment.objects.filter(student__daycare=daycare), "Child Enrollments")

            # 5. Consent Forms & Applications
            count_and_delete(ConsentSignature.objects.filter(daycare=daycare), "Consent Signatures")
            count_and_delete(ConsentFormAssignment.objects.filter(daycare=daycare), "Consent Form Assignments")
            count_and_delete(ConsentForm.objects.filter(daycare=daycare), "Consent Forms")
            count_and_delete(ApplicationDocument.objects.filter(application__daycare=daycare), "Application Documents")
            count_and_delete(RegistrationApplication.objects.filter(daycare=daycare), "Registration Applications")
            count_and_delete(WaitlistEntry.objects.filter(daycare=daycare), "Waitlist Entries")
            count_and_delete(GuardianInvitation.objects.filter(daycare=daycare), "Guardian Invitations")

            # 6. Family & Guardians
            count_and_delete(FamilyChild.objects.filter(family__daycare=daycare), "Family-Child Links")
            count_and_delete(FamilyGuardian.objects.filter(family__daycare=daycare), "Family-Guardian Links")
            
            # Find guardian users linked to this daycare
            guardians = Guardian.objects.filter(daycare=daycare)
            guardian_user_ids = list(guardians.exclude(user=None).values_list('user_id', flat=True))
            count_and_delete(guardians, "Guardians")
            count_and_delete(Family.objects.filter(daycare=daycare), "Families")
            
            if guardian_user_ids:
                guardian_users = User.objects.filter(id__in=guardian_user_ids, is_superuser=False)
                count_and_delete(guardian_users, "Guardian User Accounts")

            # 7. Students
            count_and_delete(ClassroomStudent.objects.filter(student__daycare=daycare), "Classroom Student Assignments")
            count_and_delete(Student.objects.filter(daycare=daycare), "Students")

            # 8. Staff Scheduling, Attendance & Timesheets
            count_and_delete(StaffAttendanceRecord.objects.filter(daycare=daycare), "Staff Attendance Records")
            count_and_delete(EmployeeTimesheetEntry.objects.filter(timesheet__daycare=daycare), "Timesheet Entries")
            count_and_delete(EmployeeTimesheet.objects.filter(daycare=daycare), "Timesheets")
            count_and_delete(EmployeeLeaveRequest.objects.filter(daycare=daycare), "Leave Requests")
            count_and_delete(StaffShiftSwap.objects.filter(daycare=daycare), "Staff Shift Swaps")
            count_and_delete(StaffShortageAlert.objects.filter(daycare=daycare), "Staff Shortage Alerts")
            count_and_delete(StaffSchedule.objects.filter(daycare=daycare), "Staff Schedules")

            # 9. Ratio Compliance History & Audits
            count_and_delete(RatioComplianceHistory.objects.filter(daycare=daycare), "Ratio Compliance History Records")
            count_and_delete(RatioAuditLog.objects.filter(daycare=daycare), "Ratio Audit Logs")
            count_and_delete(RatioManualOverride.objects.filter(daycare=daycare), "Ratio Overrides")
            count_and_delete(AuditLog.objects.filter(daycare=daycare), "General Audit Logs")

            # Optional: Classrooms, Programs & Age Groups
            if delete_classrooms:
                count_and_delete(ClassroomTeacherAssignment.objects.filter(daycare=daycare), "Teacher Assignments")
                count_and_delete(Classroom.objects.filter(daycare=daycare), "Classrooms")
                count_and_delete(Program.objects.filter(daycare=daycare), "Programs")
                count_and_delete(AgeGroup.objects.filter(daycare=daycare), "Age Groups")

            # Optional: Employees
            if delete_employees:
                count_and_delete(EmployeeQualification.objects.filter(employee__daycare=daycare), "Employee Qualifications")
                count_and_delete(EmployeeCertification.objects.filter(employee__daycare=daycare), "Employee Certifications")
                count_and_delete(EmployeeEmergencyContact.objects.filter(employee__daycare=daycare), "Employee Emergency Contacts")
                count_and_delete(Employee.objects.filter(daycare=daycare), "Employees")

            # Optional: Delete Daycare itself
            if delete_daycares:
                count_and_delete(Branch.objects.filter(daycare=daycare), "Branches")
                count_and_delete(Daycare.objects.filter(id=daycare.id), "Daycare Record")

    print("\n" + "=" * 70)
    print(" 🎉 CLEANUP COMPLETED SUCCESSFULLY!")
    print("=" * 70)
    print("Summary of records removed:")
    for label, count in total_counts.items():
        print(f"   • {label}: {count}")
    print("\n✅ Daycare is now completely clean and ready for fresh data!")

if __name__ == '__main__':
    # Parse CLI arguments
    import argparse
    parser = argparse.ArgumentParser(description="Clean KidSynq Daycare Data")
    parser.add_argument('--daycare', type=str, help='Target daycare name to clean (default: all daycares)')
    parser.add_argument('--include-classrooms', action='store_true', help='Also delete classrooms and programs')
    parser.add_argument('--include-employees', action='store_true', help='Also delete employees')
    parser.add_argument('--include-daycares', action='store_true', help='Also delete daycare records')

    args = parser.parse_args()
    clean_all_daycare_data(
        target_daycare_name=args.daycare,
        delete_classrooms=args.include_classrooms,
        delete_employees=args.include_employees,
        delete_daycares=args.include_daycares
    )
