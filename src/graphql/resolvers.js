import bcrypt from "bcryptjs";
import prisma from "../prismaClient.js";
import jwt from "jsonwebtoken";

// Resolver functions
export const resolvers = {
  hello: () => {
    return "Hello, GraphQL!";
  },




  //get list of users
  users: async ({ username }) => {
    if (username) {
      return await prisma.user.findMany({ where: { username } });
    }
    return await prisma.user.findMany();
  },

  //user signup or create user
  createUser: async ({ username, email, password }, { res }) => {
    try {
      // 1. Check if email already exists
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return {
          token: null,
          user: null,
          error: "User already exists with this email.",
        };
      }

      // 2. Hash the password
      const hashedPassword = await bcrypt.hash(password, 8);

      // 3. Create user and their cart in a transaction
      const createdUser = await prisma.$transaction(async (prisma) => {
        const newUser = await prisma.user.create({
          data: { username, email, password: hashedPassword },
        });

        await prisma.cart.create({
          data: { userId: newUser.id },
        });

        return newUser;
      });
      // 4. Fetch the full user object with nested data
      const userWithRelations = await prisma.user.findUnique({
        where: { id: createdUser.id },
        include: {
          addresses: true,
          cart: {
            include: {
              cartItems: {
                include: {
                  productVariant: {
                    include: {
                      product: true,
                    },
                  },
                },
              },
            },
          },
          orders: true,
          payments: true,
        },
      });

      // 5. Generate JWT token
      const token = jwt.sign(
        {
          id: userWithRelations.id,
          username: userWithRelations.username,
          email: userWithRelations.email,
          role: userWithRelations.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );

      // 6. Set cookie
      res.cookie(
        "jwt", token,
        {
          maxAge: 24 * 60 * 60,// 1 day in seconds,
          httpOnly: true,
        }
      )


      // 7. Return token and full user
      return {
        token,
        user: userWithRelations,
        error: null,
      };
    } catch (err) {
      console.error("Signup Error:", err.message);
      return {
        token: null,
        user: null,
        error: "Signup failed. Please try again.",
      };
    }
  },

  createAddress: async ({ input }) => {
    const { userId, streetAddress, landmark, city, state, postalCode } = input;

    try {
      // Create a new address
      const newAddress = await prisma.address.create({
        data: {
          userId,
          streetAddress,
          landmark,
          city,
          state,
          zipCode: postalCode,
        },
      });

      return newAddress;
    } catch (error) {
      console.error("Error creating address:", error);
      throw new Error("Failed to create address");
    }
  },

  fetchAddress: async () => {
    try {
      const addresses = await prisma.address.findMany({
        include: {
          user: true, // optional: include user info for each address
        },
      });

      if (!addresses) {
        console.warn("No addresses found.");
        return [];
      }

      return addresses;
    } catch (error) {
      console.error("Error fetching addresses:", error);
      throw new Error("Failed to fetch addresses.");
    }
  },
  fetchAddressByUser: async ({ userId }) => {
    try {
      const addresses = await prisma.address.findMany({
        where: { userId },
        include: {
          user: true, // optional: include user info for each address
        },
      });

      if (!addresses) {
        console.warn("No addresses found.");
        return [];
      }

      return addresses;
    } catch (error) {
      console.error("Error fetching addresses:", error);
      throw new Error("Failed to fetch addresses.");
    }
  },
  updateAddress: async ({ id, data }) => {
    try {
      const updatedAddress = await prisma.address.update({
        where: {
          id,
        },

        data: {
          streetAddress: data.streetAddress,
          city: data.city,
          state: data.state,
          zipCode: data.postalCode || data.zipCode, // handle either field
          landmark: data.landmark,
        },
      });

      return updatedAddress;
    } catch (error) {
      console.error("Error updating address:", error);
      throw new Error("Failed to update address.");
    }
  },


  //user login
  userLogin: async ({ email, password }, { res }) => {
    const existing_user = await prisma.user.findUnique({
      where: { email },
      include: {
        addresses: true,
        cart: {
          include: {
            cartItems: {
              include: {
                productVariant: {
                  include: {
                    product: true, // Fetch related product from the productVariant
                  }
                }
              }
            }
          }
        },
        orders: true,
        payments: true,
      },
    });
    if (existing_user) {
      try {
        const valid_password = await bcrypt.compare(
          password,
          existing_user.password
        );
        if (valid_password) {
          console.log("password is correct.");
          const token = jwt.sign(
            {
              id: existing_user.id,
              username: existing_user.username,
              email: existing_user.email,
              role: existing_user.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
          );

          res.cookie(
            "jwt", token,
            {
              maxAge: 24 * 60 * 60,// 1 day in seconds,
              httpOnly: true,
            })


          return {
            token,
            user: {
              id: existing_user.id,
              username: existing_user.username,
              email: existing_user.email,
              role: existing_user.role,
              addresses: existing_user.addresses,
              cart: existing_user.cart,
              orders: existing_user.orders,
              payments: existing_user.payments
            },
          };
        } else {
          return { error: "invalid user or password." };
        }
      } catch (error) {
        return { error: "cannot login the user" };
      }
    } else {
      return { error: "user not found." };
    }
  },

  //subcategory management
  createSubCategory: async ({
    name,
    imageUrl,
    parentCategoryId,
  }) => {
    const existingSubCategory = await prisma.category.findFirst({
      where: {
        name,
        parentCategoryId,
      },
    });

    if (existingSubCategory) {
      throw new Error(
        "Subcategory with this name already exists under this parent category. Please provide another name."
      );
    }

    const newSubCategory = await prisma.category.create({
      data: {
        name,
        imageUrl,
        parentCategoryId,
      },
    });
    return newSubCategory;
  },

  deleteSubCategory: async ({ id }) => {
    try {
      const subCategory = await prisma.category.findUnique({
        where: { id },
        include: { products: true }
      });

      if (!subCategory) {
        return {
          success: false,
          error: 'Subcategory not found.'
        };
      }

      if (subCategory.parentCategoryId === null) {
        return {
          success: false,
          error: 'Cannot delete a top-level category using this mutation.'
        };
      }

      // Step 1: Delete all products under this subcategory
      await prisma.product.deleteMany({
        where: { categoryId: id }
      });

      // Step 2: Delete the subcategory itself
      await prisma.category.delete({
        where: { id }
      });

      return {
        success: true,
        error: null
      };
    } catch (error) {
      console.error('Delete subcategory error:', error);
      return {
        success: false,
        error: 'Failed to delete subcategory and its products.'
      };
    }
  },


  updateSubCategory: async ({ id, input }) => {

    try {
      const existing = await prisma.category.findUnique({ where: { id } });

      if (!existing || !existing.parentCategoryId) {
        return {
          subCategory: null,
          error: 'Subcategory not found or is not a subcategory.'
        };
      }

      const updated = await prisma.category.update({
        where: { id },
        data: {
          name: input.name ?? existing.name,
          imageUrl: input.imageUrl ?? existing.imageUrl
        }
      });

      return {
        subCategory: updated,
        error: null
      };
    } catch (error) {
      console.error('❌ Error updating subcategory:', error);
      return {
        subCategory: null,
        error: 'Failed to update subcategory.'
      };
    }
  },
  //category management
  categories: async () => {
    return await prisma.category.findMany({
      where: {
        parentCategoryId: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        subCategories: true,
      },

    });
  },

  createCategory: async ({ name }) => {
    const existingCategory = await prisma.category.findFirst({
      where: {
        name,
      },
    });

    if (existingCategory) {
      throw new Error("Category with this name already exists. Please choose another name.");
    }
    const newCategory = await prisma.category.create({
      data: {
        name
      },
    });
    return newCategory;
  },

  deleteCategory: async ({ categoryId }) => {
    try {
      // Optional: Check if the category exists
      const existingCategory = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!existingCategory) {
        return {
          message: 'Category not found',
          success: false,
        };
      }

      // Delete the category
      await prisma.category.delete({
        where: { id: categoryId },
      });

      return {
        message: 'Category deleted successfully',
        success: true,
      };
    } catch (error) {
      console.error('Error deleting category:', error);
      return {
        message: 'Failed to delete category',
        success: false,
      };
    }
  },

  updateCategory: async ({ categoryId, newName }) => {
    try {

      // Update the category using Prisma
      const updatedCategory = await prisma.category.update({
        where: { id: categoryId },
        data: { name: newName },
      });

      return {
        success: true,
        message: 'Category updated successfully.',
        category: updatedCategory,
      };
    } catch (error) {
      console.error("Update Category Error:", error);
      return {
        success: false,
        message: error.message || 'Failed to update category.',
        category: null,
      };
    }
  },

  //product management
  products: async ({ categoryId }) => {
    const filter = categoryId ? { categoryId: parseInt(categoryId) } : {};
    return await prisma.product.findMany({
      where: filter,
      include: {
        variants: {
          include: {
            product: true
          }
        }
      }, // Include product variants
      orderBy: {
        createdAt: 'asc',
      },
    });
  },

  createProduct: async ({ name, description, categoryId, imageUrl, isActive, variants }) => {
    return await prisma.product.create({
      data: {
        name,
        description,
        categoryId,
        imageUrl,
        isActive,
        variants: {
          create: variants.map(variant => ({
            weight: variant.weight,  // Now a string ("100g", "500g", etc.)
            price: variant.price,
            mrp: variant.mrp,
            inStock: variant.inStock,    // Include stock quantity
          })),
        },
      },
      include: { variants: true },
    });
  },

  updateProduct: async ({ id, input }) => {
    try {
      // 1. Delete variants if any IDs are marked for deletion
      if (input.deletedVariantIds && input.deletedVariantIds.length > 0) {
        await prisma.productVariant.deleteMany({
          where: {
            id: { in: input.deletedVariantIds },
          },
        });
      }

      // 2. Update the product fields
      const updatedProduct = await prisma.product.update({
        where: { id },
        data: {
          name: input.name || undefined,
          description: input.description || undefined,
          imageUrl: input.imageUrl || undefined,
          isActive: typeof input.isActive !== 'undefined' ? input.isActive : undefined,
        },
      });

      // 3. Update or create product variants
      if (input.variants && input.variants.length > 0) {
        const variantPromises = input.variants.map(variant => {
          if (variant.id) {
            // Update existing variant
            return prisma.productVariant.update({
              where: { id: variant.id },
              data: {
                weight: variant.weight || undefined,
                price: variant.price || undefined,
                mrp: variant.mrp || undefined,
                inStock: typeof variant.inStock !== 'undefined' ? variant.inStock : undefined,
              },
            });
          } else {
            // Create new variant
            return prisma.productVariant.create({
              data: {
                productId: id,
                weight: variant.weight,
                price: variant.price,
                mrp: variant.mrp,
                inStock: variant.inStock
              },
            });
          }
        });

        await Promise.all(variantPromises);
      }

      // 4. Fetch the updated product with its variants
      const finalProduct = await prisma.product.findUnique({
        where: { id },
        include: { variants: true },
      });

      return { product: finalProduct, error: null };
    } catch (error) {
      console.error("❌ Failed to update product:", error);
      return { product: null, error: "Failed to update product." };
    }
  },

  deleteProduct: async ({ id }) => {
    console.log(id);
    try {
      // ✅ Step 1: Check if the product exists
      const product = await prisma.product.findUnique({
        where: { id },
        include: { variants: true },
      });

      if (!product) {
        console.log(product);
        return { success: false, error: "Product not found." };
      }

      // ✅ Step 2: Delete all associated product variants
      if (product.variants.length > 0) {
        await prisma.productVariant.deleteMany({
          where: { productId: id },
        });
      }

      // ✅ Step 3: Delete the product itself
      await prisma.product.delete({
        where: { id },
      });

      return { success: true, error: null };

    } catch (error) {
      console.error("❌ Failed to delete product:", error);
      return { success: false, error: "Failed to delete product." };
    }
  },

  addToCart: async ({ cartId, productVariantId, quantity }) => {
    try {
      const cart = await prisma.cart.findUnique({
        where: { id: cartId },
      });

      if (!cart) {
        return {
          cartItem: null,
          error: "Cart not exist",
        };
      }

      const productVariant = await prisma.productVariant.findUnique({
        where: { id: productVariantId },
      });

      if (!productVariant) {
        return {
          cartItem: null,
          error: "variant not found",
        };
      }

      if (quantity <= 0) {
        return {
          cartItem: null,
          error: "quantity must be greater than 0",
        };
      }

      let existingCartItem = await prisma.cartItem.findFirst({
        where: {
          cartId: cartId,
          productVariantId: productVariantId,
        },
      });

      if (existingCartItem) {
        // Update the quantity if the item already exists in the cart
        existingCartItem = await prisma.cartItem.update({
          where: { id: existingCartItem.id },
          data: {
            quantity: existingCartItem.quantity + quantity,
          },
        });
      } else {
        // Create a new cart item if it doesn't exist
        existingCartItem = await prisma.cartItem.create({
          data: {
            cartId: cartId,
            productVariantId: productVariantId,
            quantity: quantity,
          },
        });
      }
      return {
        error: null,
        cartItem: existingCartItem,
      };

    } catch (error) {
      console.error(error);
      return {
        error: "Failed to add product to cart.",
        cartItem: null,
      };
    }
  },

  deleteCartItem: async ({ cartItemId }) => {
    console.log("Deleting Cart Item:", cartItemId);
    try {
      const existingItem = await prisma.cartItem.findUnique({
        where: { id: cartItemId },
      });

      if (!existingItem) {
        return { success: false, error: "Cart item not found." };
      }

      await prisma.cartItem.delete({
        where: { id: cartItemId },
      });

      return { success: true, error: null };
    } catch (error) {
      console.error("❌ Failed to delete cart item:", error);
      return { success: false, error: "Failed to delete cart item." };
    }
  },

  clearCartItems: async ({ cartId }) => {
    console.log("Clearing Cart Items:", cartId);
    try {
      // Check if cart exists
      const cart = await prisma.cart.findUnique({
        where: { id: cartId },
        include: { cartItems: true },
      });

      if (!cart) {
        return { success: false, error: "Cart not found." };
      }

      // Clear cart items if any
      if (cart.cartItems.length > 0) {
        await prisma.cartItem.deleteMany({
          where: { cartId },
        });
      }

      return { success: true, error: "Cart items cleared successfully." };
    } catch (error) {
      console.error("❌ Failed to clear cart items:", error);
      return { success: false, error: "Failed to clear cart items." };
    }
  },

  updateQuantity: async ({ cartItemId, quantity }) => {
    try {
      console.log(`expected quantity is  ${quantity}`);
      // Check if cartItem exists
      const cartItem = await prisma.cartItem.findUnique({
        where: { id: cartItemId },
      });

      if (!cartItem) {
        console.log("cartItem not found.")
      }
      if ((cartItem.quantity + quantity) === 0) {
        // If quantity is 0, delete the cart item
        await prisma.cartItem.delete({
          where: { id: cartItemId },
        });
        console.log("done")
        return {
          message: "Cart item removed successfully",
          updatedQuantity: 0,
        };
      } else {
        // Otherwise, update the quantity
        const updatedCartItem = await prisma.cartItem.update({
          where: { id: cartItemId },
          data: { quantity: cartItem.quantity + quantity },
        });
        console.log("done")
        return {
          message: "Cart quantity updated successfully",
          updatedQuantity: updatedCartItem.quantity,
        };
      }
    } catch (error) {
      console.log("❌ Error updating cart quantity:", error.message);
      return {
        message: `Error updating cart quantity:  ${error.message}`,
        updatedQuantity: 0,
      }
    }

  },

  cart: async ({ cartId }) => {
    try {
      const cart = await prisma.cart.findUnique({
        where: { id: cartId },
        include: {
          cartItems: {
            include: {
              productVariant: {
                include: {
                  product: true, // Fetch related product from the productVariant
                }
              }
            }
          }
        }
      });

      if (!cart) {
        return {
          cart: null,
          error: "Cart not exist",
        };
      } else {
        console.log("cart Items found.")
        return {
          cart,
          error: null
        }
      }
    } catch (error) {
      return {
        cart: null,
        error: error
      }
    }
  },

  fetchUserOrders: async ({ userId }) => {
    try {
      const orders = await prisma.order.findMany({
        where: { userId },
        include: {
          user: true,
          shippingAddress: true,
          orderItems: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
        orderBy: { orderDate: 'desc' },
      });
      return orders.map((order) => ({
        ...order,
        orderDate: new Date(Number(order.orderDate)).toISOString(),
        deliveryDate: order.deliveryDate ? new Date(Number(order.deliveryDate)).toISOString() : null,
      }));
    } catch (error) {
      console.error('Error fetching user orders:', error);
      throw new Error('Failed to fetch user orders');
    }
  },

  fetchAllOrders: async () => {
    try {
      const orders = await prisma.order.findMany({
        include: {
          user: true,
          shippingAddress: true,
          orderItems: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
        orderBy: { orderDate: 'desc' },
      });
      return orders.map((order) => ({
        ...order,
        orderDate: new Date(Number(order.orderDate)).toISOString(),
        deliveryDate: order.deliveryDate ? new Date(Number(order.deliveryDate)).toISOString() : null,
      }));
    } catch (error) {
      console.error('Error fetching all orders:', error);
      throw new Error('Failed to fetch all orders');
    }
  },

  createOrder: async ({ input }, { io }) => {
    const { userId, addressId, paymentMethod, isPaid, orderItems } = input;

    try {
      if (!orderItems || orderItems.length === 0) {
        return {
          success: false,
          error: "Order must contain at least one item",
          order: null,
        };
      }

      const totalPrice = orderItems.reduce((sum, item) => {
        return sum + item.priceAtPurchase * item.quantity;
      }, 0);

      const order = await prisma.order.create({
        data: {
          userId,
          addressId,
          paymentMethod,
          isPaid,
          totalPrice,
          orderItems: {
            create: orderItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId || null,
              quantity: item.quantity,
              priceAtPurchase: item.priceAtPurchase,
            })),
          },
        },
        include: {
          orderItems: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
          user: true,
        },
      });

      // ✅ Emit socket event to the admin room
      const admins = await prisma.user.findMany({ where: { role: "admin" } });
      const notifications = await Promise.all(
        admins.map((admin) =>
          prisma.notification.create({
            data: {
              recipientId: admin.id,
              title: "new order placed",
              type: "ORDER_CREATED",
              message: `New order placed by ${order.user.username || "Unknown User"}`,
              isRead: false,
              orderId: order.id,
            },
          })
        )
      );
      // ✅ Log created notifications
      console.log("🔔 Notifications created:", notifications);

      return {
        success: true,
        error: null,
        order,
      };
    } catch (err) {
      console.error("Error creating order:", err);
      return {
        success: false,
        error: err.message || "An unexpected error occurred",
        order: null,
      };
    }
  },

  notification: async ({ recipientId }) => {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          recipientId,
        },
        include: {
          user: true,
        },
        orderBy: {
          createdAt: 'desc', // Optional: sort by latest
        },
      });

      return notifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw new Error('Failed to fetch notifications');
    }
  },

  markAllNotificationsAsRead: async ({ recipientId }) => {
    const result = await prisma.notification.updateMany({
      where: {
        recipientId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return {
      success: true,
      message: `${result.count} notifications marked as read.`,
    };
  },

  fetchOrderById: async ({ id }) => {
    try {
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          user: true,
          shippingAddress: true,
          orderItems: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      if (!order) {
        throw new Error("Order not found");
      }

      return {
        ...order,
        orderDate: order.orderDate instanceof Date ? order.orderDate.toISOString() : order.orderDate,
        deliveryDate: order.deliveryDate instanceof Date && order.deliveryDate !== null
          ? order.deliveryDate.toISOString()
          : null,
      };
    } catch (error) {
      console.error("Error fetching order by ID:", error);
      throw new Error("Failed to fetch order");
    }
  },

  updateOrderStatus: async ({ id, status, deliveryDate }) => {
    try {
      const updatedOrder = await prisma.order.update({
        where: { id },
        data: {
          status,
          deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        },
        include: {
          user: true,
          shippingAddress: true,
          orderItems: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });

      await prisma.notification.create({
        data: {
          recipientId: updatedOrder.userId,
          title: "Order status updated",
          type: "ORDER_UPDATED", // Keep enum/type consistent
          message: `Your order #${updatedOrder.id} has been ${status.toLowerCase()}`,
          isRead: false,
          orderId: updatedOrder.id,
        },
      });

      return {
        ...updatedOrder,
        orderDate: updatedOrder.orderDate.toISOString(),
        deliveryDate: updatedOrder.deliveryDate
          ? updatedOrder.deliveryDate.toISOString()
          : null,
      };
    } catch (error) {
      console.error("Error updating order status:", error);
      throw new Error("Failed to update order status");
    }
  },

  updateNotificationStatus: async () => { },


};
