import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AccountPage } from "./routes/AccountPage";
import { BuyAllCarPage } from "./routes/BuyAllCarPage";
import { BuyAllPage } from "./routes/BuyAllPage";
import { BuyCheckoutPage } from "./routes/BuyCheckoutPage";
import { BuyOrderPage } from "./routes/BuyOrderPage";
import { BuyCarPage } from "./routes/BuyCarPage";
import { BuyResultsPage } from "./routes/BuyResultsPage";
import { BuySearchPage } from "./routes/BuySearchPage";
import { CancellationPage } from "./routes/CancellationPage";
import { HomePage } from "./routes/HomePage";
import { PublicShell } from "./routes/PublicShell";
import { LoginPage } from "./routes/LoginPage";
import { RegisterPage } from "./routes/RegisterPage";
import { RentCheckoutPage } from "./routes/RentCheckoutPage";
import { RentOrderPage } from "./routes/RentOrderPage";
import { RentCarPage } from "./routes/RentCarPage";
import { RentResultsPage } from "./routes/RentResultsPage";
import { RentSearchPage } from "./routes/RentSearchPage";
import { StaffCarPage } from "./routes/StaffCarPage";
import { StaffCarsPage } from "./routes/StaffCarsPage";
import { StaffHomePage } from "./routes/StaffHomePage";
import { StaffRentalPage } from "./routes/StaffRentalPage";
import { StaffRentalsPage } from "./routes/StaffRentalsPage";
import { StaffSalesPage } from "./routes/StaffSalesPage";
import { StaffLoginPage } from "./routes/StaffLoginPage";
import { StaffSettingsPage } from "./routes/StaffSettingsPage";
import { StaffShell } from "./routes/StaffShell";
import { TermsPage } from "./routes/TermsPage";
import { PreferencesProvider } from "./PreferencesProvider";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <PreferencesProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/rent" element={<RentSearchPage />} />
            <Route path="/rent/results" element={<RentResultsPage />} />
            <Route path="/rent/cars/:carId" element={<RentCarPage />} />
            <Route path="/rent/checkout" element={<RentCheckoutPage />} />
            <Route path="/rent/orders/:orderId" element={<RentOrderPage />} />
            <Route path="/buy" element={<BuySearchPage />} />
            <Route path="/buy/all" element={<BuyAllPage />} />
            <Route path="/buy/all/:carId" element={<BuyAllCarPage />} />
            <Route path="/buy/results" element={<BuyResultsPage />} />
            <Route path="/buy/cars/:carId" element={<BuyCarPage />} />
            <Route path="/buy/checkout" element={<BuyCheckoutPage />} />
            <Route path="/buy/orders/:orderId" element={<BuyOrderPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/cancellation" element={<CancellationPage />} />
            <Route path="/terms" element={<TermsPage />} />
          </Route>
          <Route path="/staff/login" element={<StaffLoginPage />} />
          <Route path="/staff" element={<StaffShell />}>
            <Route index element={<StaffHomePage />} />
            <Route path="cars" element={<StaffCarsPage />} />
            <Route path="cars/new" element={<StaffCarPage />} />
            <Route path="cars/:carId" element={<StaffCarPage />} />
            <Route path="rentals" element={<StaffRentalsPage />} />
            <Route path="rentals/:orderId" element={<StaffRentalPage />} />
            <Route path="sales" element={<StaffSalesPage />} />
            <Route path="settings" element={<StaffSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </PreferencesProvider>
  </StrictMode>,
);
