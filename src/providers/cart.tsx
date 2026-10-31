import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";

type CartContextValue = {
  token: string | null;
  cart: ReturnType<typeof useCartQuery>["data"];
  isLoading: boolean;
  add: (variantId: number, quantity?: number) => void;
  update: (itemId: number, quantity: number) => void;
  remove: (itemId: number) => void;
  isMutating: boolean;
};

function useCartQuery(token: string | null) {
  return trpc.store.cart.useQuery({ token }, { retry: false });
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("deqant-cart-token"));
  const utils = trpc.useUtils();
  const query = useCartQuery(token);
  useEffect(() => {
    if (query.data?.token && query.data.token !== token) {
      localStorage.setItem("deqant-cart-token", query.data.token);
      setToken(query.data.token);
    }
  }, [query.data?.token, token]);
  const onSuccess = () => utils.store.cart.invalidate();
  const onError = (error: { message: string }) => toast.error(error.message);
  const addMutation = trpc.store.addToCart.useMutation({ onSuccess, onError });
  const updateMutation = trpc.store.updateCartItem.useMutation({ onSuccess, onError });
  const removeMutation = trpc.store.removeCartItem.useMutation({ onSuccess, onError });
  const value = useMemo<CartContextValue>(() => ({
    token, cart: query.data, isLoading: query.isLoading,
    add: (variantId, quantity = 1) => {
      if (!token) return;
      addMutation.mutate({ token, variantId, quantity }, { onSuccess: () => toast.success("Added to your fragrance wardrobe") });
    },
    update: (itemId, quantity) => token && updateMutation.mutate({ token, itemId, quantity }),
    remove: (itemId) => token && removeMutation.mutate({ token, itemId }, { onSuccess: () => toast.message("Removed from your cart") }),
    isMutating: addMutation.isPending || updateMutation.isPending || removeMutation.isPending,
  }), [token, query.data, query.isLoading, addMutation, updateMutation, removeMutation]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within CartProvider");
  return value;
}
