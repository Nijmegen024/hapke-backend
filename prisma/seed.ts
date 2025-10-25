import { PrismaClient, OrderStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'demo@restaurant.nl'
  const passwordHash = await bcrypt.hash('Demo123!', 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: 'Demo Restaurant' },
  })

  const orders = [
    {
      orderNumber: 'ORD-0001',
      paymentId: 'pay_demo_1',
      total: '14.50',
      status: OrderStatus.RECEIVED,
      items: [
        { itemId: 'pizza-margherita', name: 'Pizza Margherita', qty: 1, price: '9.50' },
        { itemId: 'cola-33cl', name: 'Cola 33cl', qty: 1, price: '5.00' },
      ],
    },
    {
      orderNumber: 'ORD-0002',
      paymentId: 'pay_demo_2',
      total: '10.90',
      status: OrderStatus.PREPARING,
      items: [
        { itemId: 'ramen-chicken', name: 'Ramen Chicken', qty: 1, price: '10.90' },
      ],
    },
    {
      orderNumber: 'ORD-0003',
      paymentId: 'pay_demo_3',
      total: '8.90',
      status: OrderStatus.ON_THE_WAY,
      items: [
        { itemId: 'burger-classic', name: 'Burger Classic', qty: 1, price: '8.90' },
      ],
    },
  ]

  for (const o of orders) {
    await prisma.order.upsert({
      where: { orderNumber: o.orderNumber },
      update: {},
      create: {
        orderNumber: o.orderNumber,
        paymentId: o.paymentId,
        total: o.total as any,
        status: o.status,
        user: { connect: { id: user.id } },
        items: {
          create: o.items.map((it) => ({
            itemId: it.itemId,
            name: it.name,
            qty: it.qty,
            price: it.price as any,
          })),
        },
      },
    })
  }

  console.log('✅ Seed voltooid: demo user + 3 orders met items')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })