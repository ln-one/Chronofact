import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import Landing from "./pages/Landing";
import Submit from "./pages/Submit";
import Assets from "./pages/Assets";
import Verify from "./pages/Verify";
import Reports from "./pages/Reports";
import Auth from "./pages/Auth";
import AiExplanation from "./pages/AiExplanation";
import Workspaces from "./pages/Workspaces";

export default function App() {
  return (
    <Routes>
      <Route index element={<Landing />} />
      <Route path="auth" element={<Auth />} />
      <Route element={<Layout />}>
        <Route path="dashboard" element={<Overview />} />
        <Route path="workspaces" element={<Workspaces />} />
        <Route path="submit" element={<Submit />} />
        <Route path="assets" element={<Assets />} />
        <Route path="verify" element={<Verify />} />
        <Route path="ai" element={<AiExplanation />} />
        <Route path="reports" element={<Reports />} />
      </Route>
    </Routes>
  );
}
