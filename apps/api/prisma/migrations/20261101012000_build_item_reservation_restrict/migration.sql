-- Build allocations survive stock, part, and BOM deletes.
-- build_line, stock_item, and install_into no longer cascade-delete or
-- null the allocation. RESTRICT is the last defense. Services reject first.
-- Authorized build deletion removes its own allocation rows explicitly.

ALTER TABLE "build_item" DROP CONSTRAINT "build_item_build_line_id_fkey";
ALTER TABLE "build_item" ADD CONSTRAINT "build_item_build_line_id_fkey" FOREIGN KEY ("build_line_id") REFERENCES "build_line"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "build_item" DROP CONSTRAINT "build_item_stock_item_id_fkey";
ALTER TABLE "build_item" ADD CONSTRAINT "build_item_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_item"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE "build_item" DROP CONSTRAINT "build_item_install_into_id_fkey";
ALTER TABLE "build_item" ADD CONSTRAINT "build_item_install_into_id_fkey" FOREIGN KEY ("install_into_id") REFERENCES "stock_item"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
