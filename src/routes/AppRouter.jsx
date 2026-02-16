import React, { useEffect, Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "../state/AuthContext";
import { OrdersProvider } from "../state/OrderContext";
import { CartProvider } from "../state/CartContext";
import { RNBridgeProvider } from "../state/RNBridgeContext";

import ProtectedRoute from "./ProtectedRoute";
import { installRnBridge } from "../bridge/installRnBridge";

// 🔥 Rutas críticas SIN lazy (evita delay inicial)
import CheckoutPage from "../pages/Checkoutpage";
import FavoritesPage from "../pages/FavoritePage";
import ProductDetailsPage from "../pages/ProductDetailspage";
import CategoryPage from "../pages/CategoryPage";

// ✅ Lazy solo para no críticas
const HomePage = lazy(() => import("../pages/Homepage"));
const VerifyUploadPage = lazy(() => import("../pages/Verifyupload"));
const LoginPage = lazy(() => import("../pages/LoginPage"));
const AccountPage = lazy(() => import("../pages/AccountPage"));
const CartPage = lazy(() => import("../pages/CartPage"));
const SearchResultsPage = lazy(() => import("../pages/ResultPage"));
const OrdersPage = lazy(() => import("../pages/OrdersPage"));
const OrderDetailsPage = lazy(() => import("../pages/OrderDetailsPage"));



function AppFallback() {
  return <div style={{ padding: 16 }}>Cargando...</div>;
}

export default function AppRouter({ initialRNState }) {

  // 🔥 Instala bridge solo para updates, no para estado inicial
  useEffect(() => {
    const uninstall = installRnBridge();
    return uninstall;
  }, []);

  return (
    <AuthProvider>
      <RNBridgeProvider initialRNState={initialRNState}>
        <OrdersProvider>
          <CartProvider>

            <Suspense fallback={<AppFallback />}>
              <Routes>

                <Route path="/" element={<HomePage />} />
                <Route path="/product/:id" element={<ProductDetailsPage />} />

                <Route
                  path="/cart"
                  element={
                    <ProtectedRoute>
                      <CartPage />
                    </ProtectedRoute>
                  }
                />


                <Route path="/search" element={<SearchResultsPage />} />

                {/* 🔥 CRÍTICA – sin lazy */}
                <Route
                  path="/checkout"
                  element={
                    <ProtectedRoute>
                      <CheckoutPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="/verify/:orderId" element={<VerifyUploadPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/categoria" element={<CategoryPage />} />

                {/* 🔥 CRÍTICA – sin lazy */}
                <Route
                  path="/account/favorites"
                  element={
                    <ProtectedRoute>
                      <FavoritesPage />
                    </ProtectedRoute>
                  }
                />
                                <Route path="/account/orders" element={<OrdersPage />} />
                <Route path="/account/orders/:id" element={<OrderDetailsPage />} />


                <Route path="*" element={<Navigate to="/" replace />} />

              </Routes>
            </Suspense>

          </CartProvider>
        </OrdersProvider>
      </RNBridgeProvider>
    </AuthProvider>
  );
}
