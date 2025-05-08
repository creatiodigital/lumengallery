-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "handler" TEXT NOT NULL,
    "biography" TEXT NOT NULL,
    "email" TEXT,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artist_handler_key" ON "Artist"("handler");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_email_key" ON "Artist"("email");
