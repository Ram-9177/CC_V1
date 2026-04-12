import re

with open("backend_django/apps/gate_passes/views.py", "r") as f:
    content = f.read()

# 1. Master Search additions
search_patch = """
        # Master Search (Phase 3 Requirement)
        search_query = self.request.query_params.get('search', '').strip()
        if search_query:
            try:
                sq = InputValidator.validate_string(search_query, "search", 50)
                if sq.isdigit():
                    # Search by Pass ID
                    queryset = queryset.filter(id=int(sq))
                else:
                    # Search by Hall Ticket or Name
                    sq_parts = sq.split()
                    if len(sq_parts) > 1:
                        queryset = queryset.filter(
                            Q(student__registration_number__icontains=sq) |
                            Q(student__first_name__icontains=sq_parts[0], student__last_name__icontains=sq_parts[1])
                        )
                    else:
                import re

with open("backenfi
with op       content = f.read()

# 1. Master Search additions
search_pats=
# 1. Master Search a   search_patch = """
        na        # Master  |        search_query = self.request.query_pa_n        if search_query:
            try:
                sq = InputValid a            try:
      gg               va                if sq.isdigit():
                    # Search by Pass ID
     (P                    # Search byte                    queryset = queryseic                else:
                    # Search by Halit                    nt                    sq_parts = sq.split()
        +                     if len(sq_parts) > 1 A                        queryset = queryta                            Q(student__registratiout                            Q(student__first_name__icontains=sq_parts[0], ur                        )
                    else:
                import re

with open("backenfi
wry:
            g                    elsect                import rre
with open("backenfi
witeaswith op       cont  
# 1. Master Search additions
sasosearch_pats=
# 1. Master Sepi# 1. Masteron        na        # Master  |        seaG_            try:
                sq = InputValid a            try:
      gg               va                       rn      gg               va                if sq.ie_                    # Search by Pass ID
     (P                (P                    # Search byec                    # Search by Halit                    nt                    sq_parts = sq.split()          +                     if lser.id, 'security_reject', 'gate_pass', gate_pass.id, success=True)                    else:
                import re

with open("backenfi
wry:
            g                    elsect                import rre
with open("backenfi
witeaswith op       cont  
# 1. Master Search additions
sasosearch_pats=
# 1. Mastti                import rIs
with open("backenfi
wrt_liwry:
            g
      with open("backenfi
witeaswith op       cont  
# 1. Master Searc
 witeaswith op     = # 1. Master Search addititasasosearch_pats=
# 1. Maste  # 1. Master Sepen                sq = InputValid a            try:
      gg               va                   gg               va                       
      (P                (P                    # Search byec                    # Search by Halit                    nt                    sn_                import re

with open("backenfi
wry:
            g                    elsect                import rre
with open("backenfi
witeaswith op       cont  
# 1. Master Search additions
sasosearch_pats=
# 1. Mastti                import rIs
with open("backenfi
wrt_liwry:
     te
with open("backenfi
wrk_exwry:
            gpk   newith open("backenfi
witeaswith op       cont  
# 1. Master Searc "witeaswith op     n)# 1. Master Search addjangosasosearch_pats=
# 1. Mastt, # 1. Mastti    f.with open("backenfi
wrt_liwry:
     iewrt_dated.")
