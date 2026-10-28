-- Địa chỉ không còn bắt buộc có quận/huyện (nhiều địa phương đã bỏ cấp này)
ALTER TABLE "addresses" ALTER COLUMN "district" DROP NOT NULL;
