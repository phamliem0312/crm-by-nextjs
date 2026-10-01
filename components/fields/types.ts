import type { ComponentType } from "react";
import type { Acl } from "@/lib/espo/acl";
import type { FieldDefs } from "@/lib/espo/entity";
import type { DateTimeFormat, NumberFormat } from "@/lib/espo/format";
import type { Translator } from "@/lib/espo/i18n";
import type { AdvancedFilter } from "@/lib/espo/search";
import type { EspoUser, Metadata, Preferences, Settings } from "@/lib/espo/types";

export type Values = Record<string, unknown>;

/** Mọi thứ một field cần để hiển thị/sửa: metadata, dịch, định dạng, quyền. */
export type FieldContext = {
  metadata: Metadata;
  t: Translator;
  dateTime: DateTimeFormat;
  numbers: NumberFormat;
  settings: Settings;
  preferences: Preferences;
  acl: Acl;
  user: EspoUser;
  classicBasePath: string;
  /** `App/user.appParams` (ví dụ `maxUploadSize` tính bằng MB). */
  appParams: Record<string, unknown>;
};

export type FieldBaseProps = {
  ctx: FieldContext;
  scope: string;
  name: string;
  defs: FieldDefs;
  values: Values;
};

export type FieldDisplayProps = FieldBaseProps & { mode: "list" | "detail" };

export type FieldEditProps = FieldBaseProps & {
  onChange: (patch: Values) => void;
  /** id của ô nhập chính, để `<label htmlFor>` trỏ tới. */
  inputId: string;
  invalid: boolean;
  required: boolean;
  /** Danh sách option do dynamic logic giới hạn (enum/multiEnum). */
  optionList?: string[];
  /** id của phần tử chứa thông báo lỗi (aria-describedby). */
  describedBy?: string;
};

export type FieldSearchProps = {
  ctx: FieldContext;
  scope: string;
  name: string;
  defs: FieldDefs;
  filter: AdvancedFilter | null;
  onChange: (filter: AdvancedFilter | null) => void;
  inputId: string;
};

export type FieldType = {
  /** Hiển thị ở list và detail. Trả về `null` khi không có giá trị. */
  Display: ComponentType<FieldDisplayProps>;
  /** Không có = chỉ đọc (autoincrement, foreign, currencyConverted…). */
  Edit?: ComponentType<FieldEditProps>;
  /** Không có = không lọc được trên UI mới. */
  Search?: ComponentType<FieldSearchProps>;
  /** Có giá trị không (để hiện "None" ở detail). Mặc định: attribute cùng tên khác rỗng. */
  hasValue?: (name: string, values: Values) => boolean;
  /** Ô nhập chiếm cả hàng (text dài, địa chỉ…). */
  wide?: boolean;
  /** Dọn dữ liệu trước khi gửi lên server (ví dụ bỏ dòng email trống). Trả về các attribute thay thế. */
  prepareSave?: (name: string, values: Values) => Values;
  /**
   * Phản ứng khi form đổi giá trị (kể cả field khác), ví dụ duration dời `dateEnd` khi `dateStart` đổi.
   * Trả về các attribute cần cập nhật thêm.
   */
  onFormChange?: (name: string, defs: FieldDefs, previous: Values, next: Values) => Values;
  /** Attribute của field khác cần gửi kèm khi lưu field này (duration → `end`). */
  saveAttributes?: (name: string, defs: FieldDefs) => string[];
  /** Giá trị mặc định khi tạo bản ghi mới, ngoài `default` của entityDefs (ví dụ nhắc nhở theo Preferences). */
  getDefault?: (ctx: FieldContext, scope: string, name: string) => Values;
  /** Bổ sung giá trị khi mở form tạo mới, sau khi đã có mọi giá trị ban đầu (duration → tính `end`). */
  onInit?: (name: string, defs: FieldDefs, values: Values) => Values;
};
