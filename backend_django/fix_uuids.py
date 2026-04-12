import sqlite3

def pad_uuid(val):
    if not val: return val
    val = str(val)
    if len(val) < 32:
        return val.zfill(32)
    return val

conn = sqlite3.connect('db.sqlite3')
c = conn.cursor()
c.execute('PRAGMA foreign_keys = OFF;')

c.execute("SELECT id, college_id FROM hostelconnect_user")
rows = c.fetchall()
for r in rows:
    uid, cid = r
    new_uid = pad_uuid(uid)
    new_cid = pad_uuid(cid)
    if new_uid != uid or new_cid != cid:
        c.execute("UPDATE hostelconnect_user SET id=?, college_id=? WHERE id=?", (new_uid, new_cid, uid))

conn.commit()
c.execute('PRAGMA foreign_keys = ON;')
conn.close()
print("All short UUIDs padded successfully.")
