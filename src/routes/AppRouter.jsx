import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "../state/AuthContext";
import { OrdersProvider } from "../state/OrderContext";
import { CartProvider } from "../state/CartContext";
import OrderDetailsPage from "../pages/OrderDetailsPage";

import HomePage from "../pages/Homepage";
import ProductDetailsPage from "../pages/ProductDetailspage";
import CheckoutPage from "../pages/Checkoutpage";
import VerifyUploadPage from "../pages/Verifyupload";

import LoginPage from "../pages/LoginPage";
import AccountPage from "../pages/AccountPage";
import OrdersPage from "../pages/OrdersPage";
import TrackingPage from "../pages/TrackingPage";
import CartPage from "../pages/CartPage";
import ProtectedRoute from "./ProtectedRoute";
import SearchResultsPage from "../pages/ResultPage";
import FavoritesPage from "../pages/FavoritePage";
import CategoryPage from "../pages/CategoryPage";

export default function AppRouter() {
  return (
    <AuthProvider>
      <OrdersProvider>
        <CartProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/product/:id" element={<ProductDetailsPage />} />

            <Route path="/cart" element={<ProtectedRoute>
<CartPage /></ProtectedRoute>} />

            <Route path="/search" element={<SearchResultsPage/>} />

            <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
            <Route path="/verify/:orderId" element={<VerifyUploadPage />} />

            <Route path="/login" element={<LoginPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/account/orders" element={<OrdersPage />} />
                        <Route path="/orders/:id" element={<OrderDetailsPage />} />
                                <Route path="/categoria" element={<CategoryPage />} />


            <Route path="/tracking" element={<TrackingPage />} />
<Route path="/account/favorites" element={<FavoritesPage />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </CartProvider>
      </OrdersProvider>
    </AuthProvider>
  );
}
