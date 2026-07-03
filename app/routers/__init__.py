from app.routers.auth import router as auth_router
from app.routers.tasks import router as tasks_router
from app.routers.chat import router as chat_router

__all__ = ["auth_router", "tasks_router", "chat_router"]
