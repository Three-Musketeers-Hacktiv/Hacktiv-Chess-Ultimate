import { Navigate, Outlet } from "react-router";

export default function BaseLayout() {
  if (!localStorage.access_token) {
    
    return <Navigate to="/login" />;
  }
  return (
    <>
      <div className="p-5">
        <Outlet />
      </div>
    </>
  );
}
