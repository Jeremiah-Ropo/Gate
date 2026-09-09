import { Route, Routes } from "react-router-dom";

import { Navbar } from "@/components/Navbar";
import { RoleRoute } from "@/components/RoleRoute";
import { AdminEventsPage } from "@/pages/admin/AdminEventsPage";
import { EventFormPage } from "@/pages/admin/EventFormPage";
import { BrowseEventsPage } from "@/pages/BrowseEventsPage";
import { EventDetailPage } from "@/pages/EventDetailPage";
import { LoginPage } from "@/pages/LoginPage";
import { MyTicketsPage } from "@/pages/MyTicketsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { CheckInPage } from "@/pages/staff/CheckInPage";

export function App() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <a href="#main-content" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <Navbar />
      <main id="main-content">
        <Routes>
          {/* Public browse: no account needed to see published events and how many tickets are left. */}
          <Route path="/" element={<BrowseEventsPage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />

          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Attendee: claim tickets, view what they've claimed. */}
          <Route
            path="/tickets"
            element={
              <RoleRoute roles={["attendee"]}>
                <MyTicketsPage />
              </RoleRoute>
            }
          />

          {/* Admin: create events and allocate how many tickets each one has. */}
          <Route
            path="/admin/events"
            element={
              <RoleRoute roles={["admin"]}>
                <AdminEventsPage />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/events/new"
            element={
              <RoleRoute roles={["admin"]}>
                <EventFormPage />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/events/:eventId/edit"
            element={
              <RoleRoute roles={["admin"]}>
                <EventFormPage />
              </RoleRoute>
            }
          />

          {/* Staff (+ admin, who the backend also allows to run the door): validate tickets
            and manage the scanners used at check-in. */}
          <Route
            path="/staff/check-in"
            element={
              <RoleRoute roles={["staff", "admin"]}>
                <CheckInPage />
              </RoleRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-4 border-t border-neutral-200 px-6 py-8 text-sm text-neutral-500">
        <span>
          <strong className="mr-4 text-neutral-900">Gate</strong> Events bring us closer.
        </span>
        <span>Find your people. Be there.</span>
      </footer>
    </div>
  );
}
