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
import { DoorEventPickerPage } from "@/pages/door/DoorEventPickerPage";
import { DoorScannerPage } from "@/pages/door/DoorScannerPage";

export function App() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
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

        {/* The door. Staff and admin only, and the backend narrows it further: every door
            route also requires an active event_members row for that specific event. */}
        <Route
          path="/door"
          element={
            <RoleRoute roles={["staff", "admin"]}>
              <DoorEventPickerPage />
            </RoleRoute>
          }
        />
        <Route
          path="/door/:eventId"
          element={
            <RoleRoute roles={["staff", "admin"]}>
              <DoorScannerPage />
            </RoleRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}
