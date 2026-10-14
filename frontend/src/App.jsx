import { BrowserRouter, Route, Routes } from "react-router";
import LoginPage from "./views/LoginPage";
import RegisterPage from "./views/RegisterPage";
import BaseLayout from "./layouts/BaseLayout";

export default function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<BaseLayout />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}
