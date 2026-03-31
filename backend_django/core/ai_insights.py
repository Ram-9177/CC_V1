"""AI Insights Service for CampusCore (Phase 8)."""
import logging
from django.db.models import Count, Avg, F
from django.utils import timezone
from datetime import timedelta
from apps.gate_passes.models import GatePass
from apps.complaints.models import Complaint

logger = logging.getLogger(__name__)

class CampusAIService:
    """Predictive analytics engine for Smart Campus OS."""
    
    @staticmethod
    def calculate_student_risk_score(student_id: int):
        """
        Analyze behavioral signals to predict potential violations.
        Signals: Late returns, pending complaints, previous status changes.
        """
        last_30_days = timezone.now() - timedelta(days=30)
        
        # 1. Late Return Signal
        late_returns = GatePass.objects.filter(
            student_id=student_id,
            status='late_return',
            exit_date__gte=last_30_days
        ).count()
        
        # 2. Frequent Exit Signal (e.g. out every day)
        total_exits = GatePass.objects.filter(
            student_id=student_id,
            exit_date__gte=last_30_days
        ).count()
        
        # Simple weighted risk score (0-100)
        score = (late_returns * 25) + (total_exits * 2)
        return min(score, 100)

    @staticmethod
    def get_block_health_metrics(college_id: int):
        """
        Identify 'Hotspots' for maintenance or disciplinary issues.
        """
        # Top 3 floors with most open complaints
        hotspots = Complaint.objects.filter(
            college_id=college_id,
            status='open'
        ).values('student__hostel__name') \
         .annotate(count=Count('id')) \
         .order_by('-count')[:5]
         
        return list(hotspots)

    @staticmethod
    def predict_meal_wastage(college_id: int, meal_type: str):
        """
        Future: Integrate with external weather/holiday APIs.
        Current: Use rolling averages of historical wastage.
        """
        from apps.meals.models import MealWastage
        avg_waste = MealWastage.objects.filter(
            meal__college_id=college_id,
            meal__meal_type=meal_type
        ).aggregate(Avg('waste_weight_kg'))
        
        return avg_waste['waste_weight_kg__avg'] or 0.0
