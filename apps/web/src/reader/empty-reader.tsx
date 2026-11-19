import { useApp } from "../app/use-app";
import { Fern } from "../icons/icon";
import { Button } from "../ui";

export function EmptyReader() {
  const { actions } = useApp();
  return (
    <div className="rd rd-empty" data-view="read">
      <Fern className="rd-empty-fern" />
      <p className="rd-empty-text">Chưa có sách</p>
      <Button className="rd-empty-add" onClick={() => actions.navigate("library")}>
        Thêm sách
      </Button>
    </div>
  );
}
