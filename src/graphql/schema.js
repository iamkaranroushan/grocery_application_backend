import { buildSchema } from "graphql";

// Define your GraphQL schema
export const schema = buildSchema(`

  
  type User {
    id: Int!
    username: String!
    email: String!
    role: String!
    orders: [Order!]
    cart: Cart
    reviews: [Review!]
    addresses: [Address!]
    payments: [Payment!]
    wishlist: Wishlist
  }

  type Category {
    id: Int!
    name: String!
    description: String
    imageUrl: String
    parentCategoryId: Int
    subCategories: [Category!]
    products: [Product!]
  }

  type Product {
    id: Int!
    name: String!
    description: String!
    categoryId: Int!
    imageUrl: String!
    isActive: Boolean!
    variants: [ProductVariant!]  # 🔹 List of variants for different weights
  }

  type ProductVariant {
    id: Int!
    productId: Int!
    product: Product
    weight: String!  # 🔹 Example: "100g", "500g", "1kg"
    price: Float!    # 🔹 Price for this weight
    mrp: Float!
    inStock: Boolean!      # 🔹 Stock availability
  }

  

  type Cart {
    id: Int!
    user: User!
    cartItems: [CartItem!]
  }

  type CartItem {
    id: Int!
    cart: Cart!
    productVariant: ProductVariant!  # 🔹 Now linked to ProductVariant instead of Product
    quantity: Int!
  }

  type Review {
    id: Int!
    product: Product!
    user: User!
    rating: Int!
    comment: String!
    createdAt: String!
  }
    
  

  type Payment {
    id: Int!
    user: User!
    order: Order!
    amount: Float!
    paymentStatus: String!
    paymentMethod: String!
    paymentDate: String!
  }

  type Wishlist {
    id: Int!
    user: User!
    wishlistItems: [WishlistItem!]
  }

  type WishlistItem {
    id: Int!
    wishlist: Wishlist!
    product: Product!
  }

  type LoginResponse {
    token: String
    user: User
    error: String
  }

  type SignupResponse {
    token: String
    user: User
    error: String
  }

  type addToCartResponse {
    cartItem: CartItem
    error: String
  }

  

  type createProductResponse {
    product: Product
    error: String
  }
  
  type DeleteProductResponse {
    success: Boolean!
    error: String
  }
  
  type updateProductResponse {
    product: Product
    error: String
  }
  

  type createProductVariantResponse {
    productVariant: ProductVariant
    error: String
  }
  type getCartResponse {
    cart: Cart
    error: String
  }

  type updateQuantityResponse {
    message: String
    updatedQuantity: Int
  }

  type createCategoryResponse {
    category: Category
    error: String
  }

  type deleteCategoryResponse {
    message: String
    success: Boolean 
  }
  type updateCategoryResponse {
    message: String
    success: Boolean 
  }

  type deleteSubCategoryResponse {
    message: String
    success: Boolean
  }
  type UpdateSubCategoryPayload {
    category: Category
    error: String
  }


  type Address {
    id: Int!
    user: User!
    streetAddress: String!
    landmark: String
    city: String!
    state: String!
    country: String!
    zipCode: String!
  }
  type Order {
    id: Int!
    user: User!
    status: String!
    totalPrice: Float!
    shippingAddress: Address
    orderDate: String!
    deliveryDate: String
    orderItems: [OrderItem!]
  }

  type OrderItem {
    id: Int!
    order: Order!
    variant: ProductVariant!  # 🔹 Now linked to ProductVariant instead of Product
    quantity: Int!
    priceAtPurchase: Float!
  }

  type updatedOrderResponse {
    order: Order
    error: String
    success: Boolean
  }

  type createOrderResponse {
    order: Order
    error: String
    success: Boolean
  }

    type Notification {
      isRead: Boolean
      user: User
    }

  type DeleteResponse {
    success: Boolean!
    error: String
  }
  type NotificationUpdateResponse {
    success: Boolean!
    message: String!
  }

  
  type Query {
    fetchAddress:[Address!]!
    fetchAddressByUser(userId: Int!):[ Address!]!
    notification(recipientId:Int!): [Notification!]
    fetchUserOrders(userId: Int!): [Order!]
    fetchAllOrders:[Order!]
    users: [User!]
    user(id: Int!): User
    categories: [Category!]
    category(id: Int!): Category
    products(categoryId: Int!): [Product!]
    cart(cartId:Int!):getCartResponse
    fetchOrderById(id: Int!): Order
  }

  
  

  type Mutation {

    
    markAllNotificationsAsRead(recipientId: Int!): NotificationUpdateResponse!
    createUser(username: String!, email: String!, password: String!): SignupResponse
    userLogin(email: String!, password: String!): LoginResponse
    
    createCategory(name: String!): Category!
    deleteCategory(categoryId: Int!):deleteCategoryResponse!
    updateCategory(categoryId: Int!, newName: String!):updateCategoryResponse!
    
    createSubCategory(name: String!, imageUrl: String parentCategoryId: Int!,): Category!
    deleteSubCategory(id: Int!):deleteSubCategoryResponse!
    updateSubCategory(id: Int!, input: UpdateSubCategoryInput!): UpdateSubCategoryPayload
    createProduct(
      name: String!, 
      description: String, 
      categoryId: Int!, 
      imageUrl: String, 
      isActive: Boolean!,
      variants: [ProductVariantInput!]
    ): Product!
    deleteProduct(id: Int!): DeleteProductResponse!
    updateProduct(id: Int!, input: UpdateProductInput!):updateProductResponse!
    
    addToCart(cartId: Int!, productVariantId: Int!, quantity: Int!):addToCartResponse!
    deleteCartItem(cartItemId: Int!): DeleteResponse!
    clearCartItems(cartId: Int!): DeleteResponse!
    updateQuantity(cartItemId: Int!, quantity: Int!): updateQuantityResponse!
    
    createAddress(input: CreateAddressInput!): Address!

    createOrder(input: createOrderInput!):createOrderResponse!
    updateOrderStatus(id: Int!, status: String!, deliveryDate: String): Order!

    updateAddress(id: Int!, data: UpdateAddressInput!): Address!

  }

  input UpdateAddressInput {
  streetAddress: String!
  city: String!
  state: String!
  postalCode: String!
  landmark: String
}

  input createOrderInput {
    userId: Int!
    addressId: Int!
    paymentMethod: PaymentMethod!
    isPaid: Boolean!
    orderItems: [OrderItemInput!]!
  }

  input OrderItemInput {
    productId: Int!
    variantId: Int
    quantity: Int!
    priceAtPurchase: Float!
  }

  enum PaymentMethod {
    COD
    ONLINE
  }

  input UpdateSubCategoryInput {
    name: String
    imageUrl: String
  }

  input ProductVariantInput {
    weight: String!     
    price: Float!    
    mrp: Float!   
    inStock: Boolean!
  }
  
  input UpdateProductInput {
    name: String
    description: String
    imageUrl: String
    isActive: Boolean
    variants: [UpdateVariantInput!]
    deletedVariantIds: [Int!]
  } 

  input UpdateVariantInput {
    id: Int
    weight: String
    mrp: Float
    price: Float
    inStock: Boolean
  }

  input CreateAddressInput {
    userId: Int!
    streetAddress: String!
    landmark: String
    city: String!
    state: String!
    postalCode: String!
  }
`);
