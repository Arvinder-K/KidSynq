"""
Core tenant and authentication middleware.
"""
class TenantContextMiddleware:
    """
    Attaches the current tenant (Daycare) to the request context.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if hasattr(request, 'user') and request.user.is_authenticated:
            try:
                request.daycare = request.user.daycare
            except Exception:
                request.daycare = None
        else:
            request.daycare = None
        return self.get_response(request)

